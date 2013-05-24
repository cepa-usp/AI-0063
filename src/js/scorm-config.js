var learnername = ""; // Nome do aluno
var completed = false; // Status da AI: completada ou não
var score = 0; // Nota do aluno (de 0 a 100)
var scormExercise = 1; // Exercício corrente relevante ao SCORM
var screenExercise = 1; // Exercício atualmente visto pelo aluno (não tem relação com scormExercise)
var scorm = pipwerks.SCORM; // Seção SCORM
scorm.version = "2004"; // Versão da API SCORM
var PING_INTERVAL = 5 * 60 * 1000; // milissegundos
var pingCount = 0; // Conta a quantidade de pings enviados para o LMS

//-- Parâmetros próprios da AI
var N_EXERCISES = 3; // Quantidade de exercícios desta AI

var X_MIN = -4;
var X_MAX = +4;
var Y_MIN = -2;
var Y_MAX = +2;
var x;
var y;

var ex1 = [];
ex1.f1 = [0, 0];
ex1.f2 = [0, 0];
ex1.f3 = [0, 0];
ex1.a  = [0, 0];
ex1.DISPLAYV1 = [0, 0];

var ex2 = [];
ex2.f1 = [0, 0];
ex2.f2 = [0, 0];
ex2.f3 = [0, 0];
ex2.a  = [0, 0];
ex2.DISPLAYV1 = [0, 0];

var massas = [0.5, 1, 2];
//----------------------------

// Inicia a AI.
$(document).ready(function(){
	$('#exercicios').tabs({
      select: function(event, ui) {
        screenExercise = ui.index + 1;
        
        //--- Hook de alteração da VISUALIZAÇÃO de exercício
        if (screenExercise == 1) {
          document.ggbApplet.setVisible("A2", true);
          document.ggbApplet.setVisible("F12", false);
          
          // Habilita as configurações do exercício 1
          document.ggbApplet.setCoords("F12", ex1.f1[0], ex1.f1[1]);
          document.ggbApplet.setCoords("F22", ex1.f2[0], ex1.f2[1]);
          document.ggbApplet.setCoords("F32", ex1.f3[0], ex1.f3[1]);
          document.ggbApplet.setCoords("A2",  ex1.a[0],  ex1.a[1]);
        }
        else if (screenExercise == 2) {
          document.ggbApplet.setVisible("A2", false);
          document.ggbApplet.setVisible("F12", true);
  
          // Habilita as configurações do exercício 1
          document.ggbApplet.setCoords("F12", ex2.f1[0], ex2.f1[1]);
          document.ggbApplet.setCoords("F22", ex2.f2[0], ex2.f2[1]);
          document.ggbApplet.setCoords("F32", ex2.f3[0], ex2.f3[1]);
          document.ggbApplet.setCoords("A2",  ex2.a[0],  ex2.a[1]);
        }
        else if (screenExercise == 3) {
          completed = true;
          scormExercise = 1;
          save2LMS();
          scorm.quit();
        }
        //--------------------------------------------------
      }
  });
	
	
	//initAI();
  tryInit();
});

function tryInit () {
	var swfOk = false;
	try {
		var pxTeste = document.ggbApplet.getXCoord("P");
		swfOk = true;
	}
	catch(error) {
		log.error("Falhou comunicação GeoGebra.");
		setTimeout(tryInit, 1000);
	}
	
	if(swfOk) initAI();
}

// Encerra a AI.
$(window).unload(function (){
  if (!completed) {
    save2LMS();
    scorm.quit();
  }
});

/*
 * Inicia a AI.
 */ 
function initAI () {
	
  $('#button1').button().click(function () {
    ex1.a[0] = parseFloat(document.ggbApplet.getXCoord("A2"));
    ex1.a[1] = parseFloat(document.ggbApplet.getYCoord("A2"));
    evaluateExercise();
  });
  
  $('#button2').button().click(function () {
    ex2.f1[0] = parseFloat(document.ggbApplet.getXCoord("F12"));
    ex2.f1[1] = parseFloat(document.ggbApplet.getYCoord("F12"));
    evaluateExercise();
  });
 
  // Conecta-se ao LMS
  var connected = scorm.init();
  
  // A tentativa de conexão com o LMS foi bem sucedida.
  if (connected) {
  
    // Verifica se a AI já foi concluída.
    var completionstatus = scorm.get("cmi.completion_status");
    
    // A AI já foi concluída.
    switch (completionstatus) {
    
      // Primeiro acesso à AI
      case "not attempted":
      case "unknown":
      default:
        completed = false;
        learnername = scorm.get("cmi.learner_name");
        scormExercise = 1;
        score = 0;
        
        $(".completion-message").removeClass("completion-message-on").addClass("completion-message-off");    
        break;
        
      // Continuando a AI...
      case "incomplete":
        completed = false;
        learnername = scorm.get("cmi.learner_name");
        scormExercise = parseInt(scorm.get("cmi.location"));
        score = parseInt(scorm.get("cmi.score.raw"));
        
        $(".completion-message").removeClass("completion-message-on").addClass("completion-message-off");
        break;
        
      // A AI já foi completada.
      case "completed":
        completed = true;
        learnername = scorm.get("cmi.learner_name");
        scormExercise = parseInt(scorm.get("cmi.location"));
        score = parseInt(scorm.get("cmi.score.raw"));
        
        $(".completion-message").removeClass("completion-message-off").addClass("completion-message-on");
        break;
    }
    
    if (isNaN(scormExercise)) scormExercise = 1;
    if (isNaN(score)) score = 0;
    
    // Posiciona o aluno no exercício da vez
    screenExercise = scormExercise;
    $('#exercicios').tabs("select", scormExercise - 1);  
    
    pingLMS();
    
    //-- Hook de inicialização da AI (dependente da seção SCORM) --
    // Nada
    //-------------------------------------------------------------
    
  }
  // A tentativa de conexão com o LMS falhou.
  else {
    completed = false;
    learnername = "";
    scormExercise = 1;
    score = 0;
    log.error("A conexão com o Moodle falhou.");
  }
  
  // (Re)abilita os exercícios já feitos e desabilita aqueles ainda por fazer.
  if (completed) $('#exercicios').tabs("option", "disabled", []);
  else {
    for (i = 0; i < N_EXERCISES; i++) {
      if (i < scormExercise) $('#exercicios').tabs("enable", i);
      else $('#exercicios').tabs("disable", i);
    }
  }
  

  
  //-- Hook de inicialização da AI (independente da seção SCORM) --
  
  // Configurações do exercício 1
  
  ex1.f1 = getRandom();
  ex1.f2 = getRandom();
  ex1.f3 = getRandom();
  ex1.a  = getRandom();
  
  var i = Math.floor(massas.length * Math.random());
  $("#massa-ex1").html(massas[i].toString().replace(".",","));
  
  // Configurações do exercício 2
  ex2.f1 = getRandom();
  ex2.f2 = getRandom();
  ex2.f3 = getRandom();
  ex2.a  = getRandom();
  
  var i = Math.floor(massas.length * Math.random());
  $("#massa-ex2").html(massas[i].toString().replace(".",","));
  
  // Habilita as configurações do exercício 1
  document.ggbApplet.setCoords("F12", ex1.f1[0], ex1.f1[1]);
  document.ggbApplet.setCoords("F22", ex1.f2[0], ex1.f2[1]);
  document.ggbApplet.setCoords("F32", ex1.f3[0], ex1.f3[1]);
  document.ggbApplet.setCoords("A2",  ex1.a[0],  ex1.a[1]);
  //---------------------------------------------------------------
}

/*
 * Salva cmi.score.raw, cmi.location e cmi.completion_status no LMS
 */ 
function save2LMS () {
  if (scorm.connection.isActive) {
  
    // Salva no LMS a nota do aluno.
    var success = scorm.set("cmi.score.raw", score);
  
    // Notifica o LMS que esta atividade foi concluída.
    success = scorm.set("cmi.completion_status", (completed ? "completed" : "incomplete"));
    
    // Salva no LMS o exercício que deve ser exibido quando a AI for acessada novamente.
    success = scorm.set("cmi.location", scormExercise);
    
    if (!success) log.error("Falha ao enviar dados para o LMS.");
  }
  else {
    log.trace("A conexão com o LMS não está ativa.");
  }
}

/*
 * Mantém a conexão com LMS ativa, atualizando a variável cmi.session_time
 */
function pingLMS () {

	scorm.get("cmi.completion_status");
	var timer = setTimeout("pingLMS()", PING_INTERVAL);
}

/*
 * Avalia a resposta do aluno ao exercício atual. Esta função é executada sempre que ele pressiona "terminei".
 */ 
function evaluateExercise (event) {

  // Avalia a nota
  var currentScore = getScore(screenExercise);

  // Mostra a mensagem de erro/acerto
  feedback(screenExercise, currentScore);

  // Atualiza a nota do LMS (apenas se a questão respondida é aquela esperada pelo LMS)
  if (!completed && screenExercise == scormExercise) {
    score = Math.max(0, Math.min(score + currentScore, 100));
    
    if (scormExercise < N_EXERCISES) {
      nextExercise();
    }
    else {
      completed = true;
      scormExercise = 1;
      save2LMS();
      scorm.quit();
    }
  }
}

/*
 * Prepara o próximo exercício.
 */ 
function nextExercise () {
  if (scormExercise < N_EXERCISES) ++scormExercise;
  
  $('#exercicios').tabs("enable", (scormExercise - 1));
  
  //-- Hook na mudança de exercício --
  // Nada
  //----------------------------------
}

/*
 * Avalia a nota do aluno num dado exercício
 * HOOK DE AVALIAÇÃO
 */ 
function getScore (exercise) {

  ans = 0;

  switch (exercise) {
  
    // Avalia a nota do exercício 1
    case 1:
      var f1_x = document.ggbApplet.getXcoord('F12');
      var f1_y = document.ggbApplet.getYcoord('F12');

      var f2_x = document.ggbApplet.getXcoord('F22');
      var f2_y = document.ggbApplet.getYcoord('F22');

      var f3_x = document.ggbApplet.getXcoord('F32');
      var f3_y = document.ggbApplet.getYcoord('F32');

      var a_x = document.ggbApplet.getXcoord('A2');
      var a_y = document.ggbApplet.getYcoord('A2');

      var ft_x = f1_x + f2_x + f3_x;
      var ft_y = f1_y + f2_y + f3_y;

      var massa = parseFloat($('#massa-ex1').html().replace(',','.'));

      if (a_x == ft_x/massa &&
          a_y == ft_y/massa) {
        ans = 50;
      }

      break;
      
    // Avalia a nota do exercício 2
    case 2:
      var f1_x = document.ggbApplet.getXcoord('F12');
      var f1_y = document.ggbApplet.getYcoord('F12');

      var f2_x = document.ggbApplet.getXcoord('F22');
      var f2_y = document.ggbApplet.getYcoord('F22');

      var f3_x = document.ggbApplet.getXcoord('F32');
      var f3_y = document.ggbApplet.getYcoord('F32');

      var a_x = document.ggbApplet.getXcoord('A2');
      var a_y = document.ggbApplet.getYcoord('A2');

      var ft_x = f1_x + f2_x + f3_x;
      var ft_y = f1_y + f2_y + f3_y;

      var massa = parseFloat($('#massa-ex2').html().replace(',','.'));

      if (massa*a_x == ft_x &&
          massa*a_y == ft_y) {
        ans = 50;
      }

      break;
  }
  
  return ans;
}

/*
 * Exibe a mensagem de erro/acerto (feedback) do aluno para um dado exercício e nota (naquele exercício).
 * HOOK DE FEEDBACK 
 */

function feedback (exercise, score) {
                     
  switch (exercise) {
  
    // Feedback da resposta ao exercício 1
    case 1:
    default:
      if (score == 50) {
          $('#message1').html('<p/>Resposta correta!').removeClass().addClass("right-answer");
      } else {
          $('#message1').html('<p/>Resposta incorreta.').removeClass().addClass("wrong-answer");
      }
      
      break;
    
    // Feedback da resposta ao exercício 2
    case 2:
      if (score == 50) {
          $('#message2').html('<p/>Resposta correta!').removeClass().addClass("right-answer");
      } else {
          $('#message2').html('<p/>Resposta incorreta.').removeClass().addClass("wrong-answer");
      }
      
      break;
  }
}

function getRandom () {
  x = X_MIN + Math.floor((X_MAX - X_MIN + 1) * Math.random());
  y = Y_MIN + Math.floor((Y_MAX - Y_MIN + 1) * Math.random());
  if (x == 0 && y == 0) y = 1;
  return [x, y];
}

var log = {};

log.trace = function (message) {
  if(window.console && window.console.firebug){
    console.log(message);
  }
  else {
    alert(message);
  }  
}

log.error = function (message) {
  if( (window.console && window.console.firebug) || console){
    console.error(message);
  }
  else {
    alert(message);
  }
}

