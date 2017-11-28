var fs = require('fs');

process.on('unhandledRejection', (reason) => {
  console.error(reason);
  process.exit(1);
});

try {
	var Discord = require("discord.js");
} catch (e){
	console.log(e.stack);
	console.log(process.version);
	console.log("Ejecute npm instalar y asegúrese de que pasa sin errores!");
	process.exit();
}
console.log("Iniciando DavidBASSXDBOT\nNode version: " + process.version + "\nDiscord.js version: " + Discord.version);



// Obtener datos de autenticación
try {
	var AuthDetails = require("./auth.json");
} catch (e){
	console.log("Crea un auth.json como auth.json.example con un token de bot o un correo electrónico y una contraseña.\n"+e.stack);
	process.exit();
}

// Cargar permisos personalizados
var dangerousCommands = ["eval","pullanddeploy","setUsername"];
var Permissions = {};
try{
	Permissions = require("./permissions.json");
} catch(e){
	Permissions.global = {};
	Permissions.users = {};
}

for( var i=0; i<dangerousCommands.length;i++ ){
	var cmd = dangerousCommands[i];
	if(!Permissions.global.hasOwnProperty(cmd)){
		Permissions.global[cmd] = false;
	}
}
Permissions.checkPermission = function (user,permission){
	try {
		var allowed = true;
		try{
			if(Permissions.global.hasOwnProperty(permission)){
				allowed = Permissions.global[permission] === true;
			}
		} catch(e){}
		try{
			if(Permissions.users[user.id].hasOwnProperty(permission)){
				allowed = Permissions.users[user.id][permission] === true;
			}
		} catch(e){}
		return allowed;
	} catch(e){}
	return false;
}
fs.writeFile("./permissions.json",JSON.stringify(Permissions,null,2));

//cargar datos de configuración
var Config = {};
try{
	Config = require("./config.json");
} catch(e){ //sin archivo de configuración, use los valores predeterminados	
	Config.debug = false;
	Config.commandPrefix = '!';
	try{
		if(fs.lstatSync("./config.json").isFile()){
			console.log("AVISO: config.json encontrado, pero no lo pudimos leer!\n" + e.stack);
		}
	} catch(e2){
		fs.writeFile("./config.json",JSON.stringify(Config,null,2));
	}
}
if(!Config.hasOwnProperty("commandPrefix")){
	Config.commandPrefix = '!';
}

var messagebox;
var aliases;
try{
	aliases = require("./alias.json");
} catch(e) {
	//Nose fe definen Alias
	aliases = {};
}

var commands = {	
	"alias": {
		usage: "<nombre> <comando actual>",
		description: "Crea alias de comandos. Útil para hacer comandos sencillos sobre la marcha",
		process: function(bot,msg,suffix) {
			var args = suffix.split(" ");
			var name = args.shift();
			if(!name){
				msg.channel.send(Config.commandPrefix + "alias " + this.usage + "\n" + this.description);
			} else if(commands[name] || name === "ayuda"){
				msg.channel.send("sobrescribir comandos con alias no está permitido!");
			} else {
				var command = args.shift();
				aliases[name] = [command, args.join(" ")];
				//now save the new alias
				require("fs").writeFile("./alias.json",JSON.stringify(aliases,null,2), null);
				msg.channel.send("alias creado	" + name);
			}
		}
	},
	"aliases": {
		description: "lista todos los alias registrados",
		process: function(bot, msg, suffix) {
			var text = "alias actuales:\n";
			for(var a in aliases){
				if(typeof a === 'string')
					text += a + " ";
			}
			msg.channel.send(text);
		}
	},
    "ping": {
        description: "responde pong, útil para comprobar si bot está vivo",
        process: function(bot, msg, suffix) {
            msg.channel.send( msg.author+" pong!");
            if(suffix){
                msg.channel.send( "Tenga en cuenta que! ping no tiene argumentos!");
            }
        }
    },
    "idle": {
				usage: "[status]",
        description: "establece el estado del bot en inactivo",
        process: function(bot,msg,suffix){ 
	    bot.user.setStatus("idle");
	    bot.user.setGame(suffix);
	}
    },
    "online": {
				usage: "[status]",
        description: "establece el estado del bot en línea",
        process: function(bot,msg,suffix){ 
	    bot.user.setStatus("online");
	    bot.user.setGame(suffix);
	}
    },
    "decir": {
        usage: "<mensage>",
        description: "bot dice mensaje",
        process: function(bot,msg,suffix){ msg.channel.send(suffix);}
    },
	"anunciar": {
        usage: "<mensaje>",
        description: "bot dice mensaje con texto a voz",
        process: function(bot,msg,suffix){ msg.channel.send(suffix,{tts:true});}
    },
	"msg": {
		usage: "<usuario> <mensaje para dejar al usuario>",
		description: "deja un mensaje para un usuario la próxima vez que vienen en línea",
		process: function(bot,msg,suffix) {
			var args = suffix.split(' ');
			var user = args.shift();
			var message = args.join(' ');
			if(user.startsWith('<@')){
				user = user.substr(2,user.length-3);
			}
			var target = msg.channel.guild.members.find("id",user);
			if(!target){
				target = msg.channel.guild.members.find("nombre de usuario",user);
			}
			messagebox[target.id] = {
				channel: msg.channel.id,
				content: target + ", " + msg.author + " dijo: " + message
			};
			updateMessagebox();
			msg.channel.send("mensaje Guardado.")
		}
	},
	"eval": {
		usage: "<comando>",
		description: 'Ejecuta javascript arbitrario en el proceso bot. El usuario debe tener permiso "eval"',
		process: function(bot,msg,suffix) {
			if(Permissions.checkPermission(msg.author,"eval")){
				msg.channel.send( Staff(suffix,bot));
			} else {
				msg.channel.send( msg.author + " no tiene permiso para ejecutar eval!");
			}
		}
	}
};

if(AuthDetails.hasOwnProperty("client_id")){
	commands["invite"] = {
		description: "genera un enlace de invitación que puedes usar para invitar al robot a tu servidor",
		process: function(bot,msg,suffix){
			msg.channel.send("link para que me invites a otros servidors :D: https://discordapp.com/oauth2/authorize?&client_id=" + AuthDetails.client_id + "&scope=bot&permissions=2146958591");
		}
	}
}


try{
	messagebox = require("./messagebox.json");
} catch(e) {
	//no stored messages
	messagebox = {};
}
function updateMessagebox(){
	require("fs").writeFile("./messagebox.json",JSON.stringify(messagebox,null,2), null);
}

var bot = new Discord.Client();

bot.on("ready", function () {
	console.log("Conectado! Sirviendo en " + bot.guilds.array().length + " Discord Chats :D");
	require("./plugins.js").init();
	console.log("type "+Config.commandPrefix+"d!ayuda en Discord para una lista de comandos.");
	bot.user.setGame(Config.commandPrefix+"ayuda | " + bot.guilds.array().length +" Servers"); 
});

bot.on("disconnected", function () {

	console.log("Desconectado!");
	process.exit(1); //exit node.js con un error

});

function checkMessageForCommand(msg, isEdit) {
	//comprobar si el mensaje es un comando
	if(msg.author.id != bot.user.id && (msg.content.startsWith(Config.commandPrefix))){
        console.log("treating " + msg.content + " from " + msg.author + " as command");
		var cmdTxt = msg.content.split(" ")[0].substring(Config.commandPrefix.length);
        var suffix = msg.content.substring(cmdTxt.length+Config.commandPrefix.length+1);// añadir uno para el! y uno para el espacio
        if(msg.isMentioned(bot.user)){
			try {
				cmdTxt = msg.content.split(" ")[1];
				suffix = msg.content.substring(bot.user.mention().length+cmdTxt.length+Config.commandPrefix.length+1);
			} catch(e){ //sin orden
				msg.channel.send("Si?");
				return;
			}
        }
		alias = aliases[cmdTxt];
		if(alias){
			console.log(cmdTxt + " es un alias, el comando construido es " + alias.join(" ") + " " + suffix);
			cmdTxt = alias[0];
			suffix = alias[1] + " " + suffix;
		}
		var cmd = commands[cmdTxt];
        if(cmdTxt === "ayuda"){
            //la ayuda es especial ya que itera sobre los otros comandos
						if(suffix){
							var cmds = suffix.split(" ").filter(function(cmd){return commands[cmd]});
							var info = "";
							for(var i=0;i<cmds.length;i++) {
								var cmd = cmds[i];
								info += "**"+Config.commandPrefix + cmd+"**";
								var usage = commands[cmd].usage;
								if(usage){
									info += " " + usage;
								}
								var description = commands[cmd].description;
								if(description instanceof Function){
									description = description();
								}
								if(description){
									info += "\n\t" + description;
								}
								info += "\n"
							}
							msg.channel.send(info);
						} else {
							msg.author.send("**Comandos disponibles:**").then(function(){
								var batch = "";
								var sortedCommands = Object.keys(commands).sort();
								for(var i in sortedCommands) {
									var cmd = sortedCommands[i];
									var info = "**"+Config.commandPrefix + cmd+"**";
									var usage = commands[cmd].usage;
									if(usage){
										info += " " + usage;
									}
									var description = commands[cmd].description;
									if(description instanceof Function){
										description = description();
									}
									if(description){
										info += "\n\t" + description;
									}
									var newBatch = batch + "\n" + info;
									if(newBatch.length > (1024 - 8)){ //limitar la longitud del mensaje
										msg.author.send(batch);
										batch = info;
									} else {
										batch = newBatch
									}
								}
								if(batch.length > 0){
									msg.author.send(batch);
								}
						});
					}
        }
		else if(cmd) {
			if(Permissions.checkPermission(msg.author,cmdTxt)){
				try{
					cmd.process(bot,msg,suffix,isEdit);
				} catch(e){
					var msgTxt = "mando " + cmdTxt + " ha fallado :(";
					if(Config.debug){
						 msgTxt += "\n" + e.stack;
					}
					msg.channel.send(msgTxt);
				}
			} else {
				msg.channel.send("No se le permite correr	" + cmdTxt + "!");
			}
		} else {
			msg.channel.send(cmdTxt + " no reconocido como un comando!").then((message => message.delete(5000)))
		}
	} else {
		//mensaje no es un comando o es de nosotros
        //soltar nuestros propios mensajes para evitar los lazos de retroalimentación
        if(msg.author == bot.user){
            return;
        }

        if (msg.author != bot.user && msg.isMentioned(bot.user)) {
                msg.channel.send("yes?"); //usando una mención aquí puede conducir al bucle				
        } else {

				}
    }
}

bot.on("message", (msg) => checkMessageForCommand(msg, false));
bot.on("messageUpdate", (oldMessage, newMessage) => {
	checkMessageForCommand(newMessage,true);
});

//Cambios en el estado de los usuarios registrados
bot.on("presence", function(user,status,gameId) {
	//if(status === "online"){
	//console.log("presence update");
	console.log(user+" went "+status);
	//}
	try{
	if(status != 'offline'){
		if(messagebox.hasOwnProperty(user.id)){
			console.log("mensaje encontrado para " + user.id);
			var message = messagebox[user.id];
			var channel = bot.channels.get("id",message.channel);
			delete messagebox[user.id];
			updateMessagebox();
			bot.send(channel,message.content);
		}
	}
	}catch(e){}
});


exports.addCommand = function(commandName, commandObject){
    try {
        commands[commandName] = commandObject;
    } catch(err){
        console.log(err);
    }
}
exports.commandCount = function(){
    return Object.keys(commands).length;
}
if(AuthDetails.bot_token){
	console.log("inicio de sesión con token");
	bot.login(AuthDetails.bot_token);
} else {
	console.log("¡Ya no es compatible con las credenciales de usuario! \ NUsted puede utilizar el registro basado en token con una cuenta de usuario, consulte\nhttps://discord.js.org/#/docs/main/master/general/updating");
}
