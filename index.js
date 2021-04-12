/* External Modules */
const Discord = require("discord.js");
const fs = require("fs");
const path = require("path");
const AntiSpam = require("discord-anti-spam");
const winston = require("winston");
const flatted = require("flatted");

const logger = winston.createLogger({
    level: "info",
    format: winston.format.json(),
    defaultMeta: { service: "user-service" },
    transports: [
        // - Write all logs with level `error` and below to `botErrors.log`
        // - Write all logs with level `info` and below to `combined.log`
        new winston.transports.File({
            filename: path.join(__dirname, "/botErrors.log"),
            level: "error",
        }),
        new winston.transports.File({ filename: "combined.log" }),
    ],
});
const DBS = {};
DBS.Bot = new Discord.Client({ ws: { intents: new Discord.Intents(Discord.Intents.ALL) } });

DBS.MsgHandler = require("./Handlers/Message");
DBS.EventHandler = require("./Handlers/Events");
DBS.usercache = require("./BotData/usercache");
DBS.Cache = require("./BotData/varcache");
DBS.Discord = Discord;

DBS.SettingsFile = require("./BotData/Settings/Settings.json");
DBS.RulesFile = require("./BotData/Settings/Rules.json");
DBS.EventsFile = require("./BotData/commands/events");
DBS.CommandsFile = require("./BotData/commands/commands");
DBS.UserFile = __dirname + "/BotData/user/user.json";
DBS.antiSpam = new AntiSpam(DBS.RulesFile.obj);

DBS.Mods = new Map();

DBS.loadMods = async function () {
    require("fs")
        .readdirSync(require("path").join(__dirname, "mods"))
        .forEach((mod) => {
            const fetchedMod = require(require("path").join(__dirname, `mods/${mod}`));
            fetchedMod.init(DBS);
            if (fetchedMod.isEvent) {
                DBS.Bot.on(fetchedMod.name, fetchedMod.mod.bind(null, DBS.Bot));
            } else if (fetchedMod.isResponse) {
                DBS.Mods.set(fetchedMod.name, fetchedMod);
            }
        });
};

DBS.checkMessage = async function (message) {
    const prefix = DBS.SettingsFile.prefix;
    if (message.author.bot) return;

    try {
        DBS.EventHandler.Event_Handle(DBS, DBS.EventsFile, 0, "Any Message", message.member);
        DBS.antiSpam.message(message);

        if (!message.content.startsWith(prefix)) return;
        const args = message.content.slice(prefix.length).trim().split(/ +/g);
        const command = args.shift();
        var hasPermission = false;

        for (const commandF of DBS.CommandsFile.command) {
            if (commandF.name == command) {
                if (!commandF.perms || commandF.perms.length === 0) {
                    hasPermission = true;
                } else {
                    // Verify permissions
                    message.member.roles.cache.forEach((role) => {
                        commandF.perms.forEach((perm) => {
                            if (role.name.toLowerCase() === perm.toLowerCase()) {
                                // Only execute actions if permissions check passes
                                hasPermission = true;
                            }
                        });
                    });
                }

                if (hasPermission) {
                    if (commandF.actions.length > 0) {
                        DBS.callNextAction(commandF, message, args, 0);
                    }
                }
            }

            fs.writeFileSync(
                DBS.UserFile,
                JSON.stringify(DBS.usercache.memoryCache, null, 2),
                function (err) {
                    if (err) return console.log(err);
                }
            );
            fs.writeFileSync(
                __dirname + "/BotData/variables/servervars.json",
                flatted.stringify(DBS.serverVars, null, 2),
                function (err) {
                    if (err) return console.log(err);
                }
            );
            fs.writeFileSync(
                __dirname + "/BotData/variables/globalvars.json",
                flatted.stringify(DBS.globalVars, null, 2),
                function (err) {
                    if (err) return console.log(err);
                }
            );
        }
    } catch (error) {
        logger.log({
            level: "error",
            message: "Check Message: " + "[" + message.content + "] " + error.stack,
        });
    }
};
/**
 * Calls the action(response) at a given index, whether a mod or standard  message handler response
 */
DBS.callNextAction = async function (command, message, args, index) {
    try {
        var action = command.actions[index];
        var fetchedAction;
        if (action.type) {
            fetchedAction = DBS.Mods.get(action.type);
        } else {
            fetchedAction = null;
        }

        if (!fetchedAction) {
            var msg = message;
            msg.content = message.content.slice(DBS.SettingsFile.prefix.length);
            DBS.MsgHandler.Message_Handle(DBS, msg, command, index, args);
        } else {
            fetchedAction.mod(DBS, message, action, args, command, index);
        }
    } catch (error) {
        logger.log({
            level: "error",
            message: "Call next action: " + "[" + message.content + "] " + error.stack,
        });
    }
};

/**
 * Calls the action(response) at a given index, whether a mod or standard event handler response
 */
DBS.callNextEventAction = async function (type, varsE, index) {
    DBS.EventHandler.Event_Handle(DBS, DBS.EventsFile, index, type, varsE);
};

DBS.startBot = async function () {
    await DBS.Bot.login(DBS.SettingsFile.token).catch((e) => {
        logger.log({
            level: "error",
            message: "Bot login: " + e,
        });
    });
    console.log("Bot logged in");

    DBS.CheckIfLoaded();
};

DBS.LoadedGuilds = [];

DBS.CheckIfLoaded = async function () {
    DBS.Bot.guilds.cache.forEach((guild) => {
        if (guild.available) {
            if (!DBS.LoadedGuilds.includes(guild.name)) {
                DBS.LoadedGuilds.push(guild.name);
                var serverObj = {};
                serverObj.guild = guild;
                DBS.callNextEventAction("Bot Initialization", serverObj, 0);
            }
        } else {
            setTimeout(DBS.CheckIfLoaded, 500);
        }
    });
};

DBS.loadBot = async function () {
    await DBS.loadMods().catch((e) => {
        logger.log({
            level: "error",
            message: "Loading mods: " + e,
        });
    });
    await DBS.startBot();
};

DBS.Bot.on("message", (message) => DBS.checkMessage(message));
DBS.Bot.on("guildMemberAdd", (member) => {
    try {
        DBS.EventHandler.Event_Handle(DBS, DBS.EventsFile, 0, "User Joins Server", member);
    } catch (error) {
        logger.log({
            level: "error",
            message: "Guild member add: " + error.stack,
        });
    }
});
DBS.Bot.on("guildMemberRemove", (member) => {
    try {
        DBS.EventHandler.Event_Handle(DBS, DBS.EventsFile, 0, "User Kicked", member);
    } catch (error) {
        logger.log({
            level: "error",
            message: "Guild member remove: " + error.stack,
        });
    }
});
DBS.Bot.on("guildBanAdd", (guild, user) => {
    let banVars = {};
    banVars.guild = guild;
    banVars.user = user;
    try {
        DBS.EventHandler.Event_Handle(DBS, DBS.EventsFile, 0, "User Banned", banVars);
    } catch (error) {
        logger.log({
            level: "error",
            message: "Guild ban add: " + error.stack,
        });
    }
});

DBS.loadVars = async function () {
    DBS.serverVars = {};
    DBS.globalVars = {};
    try {
        var rawserverdata = fs.readFileSync(__dirname + "/BotData/variables/servervars.json");
        var serverdata = flatted.parse(rawserverdata);
    } catch (error) {
        var serverdata = {};
    }

    try {
        var rawglobaldata = fs.readFileSync(__dirname + "/BotData/variables/globalvars.json");
        var globaldata = flatted.parse(rawglobaldata);
    } catch (error) {
        var globaldata = {};
    }

    DBS.serverVars = serverdata;
    DBS.globalVars = globaldata;
};

DBS.loadVars();
DBS.loadBot();

/* If the UI program is closed, kill the bot so the process isn't left hanging */
function cleanExit() {
    try {
        console.log("Killing bot");
        DBS.Bot.destroy();
        process.exit(0);
    } catch (error) {
        console.log(error);
    }
}

//process.on("SIGINT", cleanExit()); // catch ctrl-c
//process.on("SIGTERM", cleanExit());

process.on("message", (msg) => {
    if (msg.action === "STOP") {
        // Execute Graceful Termination code
        cleanExit();
    }
});
