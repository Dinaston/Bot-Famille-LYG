const Discord = require("discord.js");
const MsgHandler = require("./Message");
cache = require("../BotData/varcache");
usercache = require("../BotData/usercache");
var usersFile = __dirname + "/../BotData/user/user.json";
var userCache = usercache.memoryCache.users;
const Functions = require("../DiscordFunctions");
var guild;
var breakFailure = true;
const fs = require("fs");
const Papa = require("papaparse");
const path = require("path");
vars = {};
var DBS;
var varsEToPass;
var serverVars = {};
var globalVars = {};

module.exports.Event_Handle = async function (dbs, events, index, type, varsE, aEvent) {
    var client = dbs.Bot;
    DBS = dbs;
    var applicableEvent;
    guild = varsE.guild;
    varsEToPass = varsE;
    console.log("handling event :" + type);
    console.log(varsE.guild.name);
    serverVars = dbs.serverVars;
    globalVars = dbs.globalVars;

    if (!aEvent) {
        applicableEvent = events.command.find(e => e.name == type);
        if (varsE) {
            if (!cache[guild.id]) cache[guild.id] = {};
            let cVars = cache[guild.id];
            if (!cVars.variables) cVars.variables = [];
            let vararray = cVars.variables;

            if (applicableEvent) {
                vararray[applicableEvent.var.user] = varsE;
                cVars.variables = vararray;
                cache[guild.id] = cVars;
            }
        }
    } else {
        applicableEvent = aEvent;
    }
    if (applicableEvent && breakFailure) {
        if (index < applicableEvent.actions.length) {
            var action = applicableEvent.actions[index];
            action.guild = varsE.guild;
            await this.RunAction(client, action, type, index, varsE);
            //dbs.callNextEventAction(type, varsE, index + 1);
            this.Event_Handle(DBS, "", index + 1, "", varsE, applicableEvent);
        }
    } else {
        console.log("Failed to find event: " + type);
    }
};

module.exports.RunAction = async function (client, action) {
    console.log("temp vars");
    console.log(cache[action.guild.id]);
    var parsedAction = ParseActionVariables(action);
    switch (parsedAction.type) {
        case "Send Message":
            await SendMessage(client, parsedAction);
            break;
        case "Send Image":
            await SendImage(client, parsedAction);
            break;
        case "Send Embed":
            await SendEmbed(client, parsedAction);
            break;
        case "Send Direct Message":
            await SendDirectMessage(client, parsedAction);
            break;
        case "Add Role to User":
            AddRoletoUser(client, parsedAction);
            break;
        case "Set User Data":
            SetUserData_Handle(client, parsedAction);
            break;
        case "Get User Data":
            StoreValueinVariable_Handle(client, parsedAction);
            break;
        case "Edit User Data":
            EditUserData(client, parsedAction);
            break;
        case "Check User Data":
            this.CheckUserData(client, parsedAction);
            break;
        case "Get Row":
            GetRow_Handle(client, parsedAction);
            break;
        case "Generate Random Number":
            StoreValueinVariable_Handle(client, parsedAction);
            break;
        case "Edit Variable":
            EditVariable_Handle(client, parsedAction);
            break;
        case "Check Variable Value":
            this.CheckVariableValue_Handle(client, parsedAction);
            break;
        case "Check User Permissions":
            this.CheckUserPermissions_Handle(client, parsedAction);
            break;
        case "Remove Role From User":
            RemoveRoleFromUser(client, parsedAction);
            break;
    }
};

function saveTypeDef(currentGuild, type, value, key) {
    if (currentGuild && type && value && key) {
        console.log("saving type def");
        console.log(currentGuild.name);
        if (!serverVars[currentGuild.id]) serverVars[currentGuild.id] = {};
        if (!cache[currentGuild.id]) cache[currentGuild.id] = {};
        if (!cache[currentGuild.id].variables) cache[currentGuild.id].variables = {};

        var variableObject;
        if (type === "server") {
            variableObject = serverVars[currentGuild.id];
        } else if (type === "global") {
            variableObject = globalVars;
        } else {
            variableObject = cache[currentGuild.id].variables;
        }
        variableObject[key] = value;

        console.log("Server: ");
        console.log(serverVars);
        console.log("Global: ");
        console.log(globalVars);
        console.log("Temp: ");
        console.log(cache);
    }
}

async function SendMessage(client, action) {
    var guild = action.guild;
    let chan = guild.channels.cache.find(ch => ch.name === action.channelname || ch.id === action.channelname);
    if (!chan && action.channelname != "") {
        console.log("ERROR: No channel found with name: " + action.channelname + ". Action name: " + action.name);
    } else {
        var sent = await chan.send(action.messagetext);
        saveTypeDef(guild, action.savetovariabletype, sent, action.savetovariable);
    }
}

async function SendImage(client, action) {
    var guild = action.guild;
    const chan = guild.channels.cache.find(ch => ch.name === action.channelname || ch.id === action.channelname);
    if (!chan && action.channelname != "") {
        console.log("ERROR: No channel found with name: " + action.channelname + ". Action name: " + action.name);
    } else {
        var sent = await chan.send({ files: [action.url] });
        saveTypeDef(guild, action.savetovariabletype, sent, action.savetovariable);
    }
}

async function SendEmbed(client, action) {
    var guild = action.guild;
    const Embed = new Discord.MessageEmbed()
        .setColor(action.color)
        .setTitle(action.title)
        .setURL(action.url)
        .setAuthor(action.authorname, action.authorimageurl, action.authorlink)
        .setDescription(action.description)
        .setThumbnail(action.thumbnail)
        .setImage(action.image)
        .setFooter(action.footer);
    if (action.timestamp == "BOOL_TRUE@@") {
        Embed.setTimestamp();
    }

    if (action.fields) {
        action.fields.forEach(field => {
            var inlineTrue = field.inline == "true";
            if (field.name !== "" && field.value !== "") Embed.addField(field.name, field.value, inlineTrue);
        });
    }

    const chan = guild.channels.cache.find(ch => ch.name === action.channelname || ch.id === action.channelname);
    // Validate channel
    if (!chan && action.channelname != "") {
        console.log("ERROR: No channel found with name: " + action.channelname + ". Action name: " + action.name);
    } else {
        var sent = await chan.send(Embed);
        saveTypeDef(guild, action.savetovariabletype, sent, action.savetovariable);
    }
}

async function SendDirectMessage(client, action) {
    var guild = action.guild;
    var member = guild.members.cache.find(gm => gm.user.tag == action.user || gm.user.id == action.user);

    if (!member) {
        console.log("ERROR: No user found for direct message");
    } else {
        var sent = await member.send(action.messagetext);
        saveTypeDef(guild, action.savetovariabletype, sent, action.savetovariable);
    }
}

function AddRoletoUser(client, action) {
    var guild = action.guild;
    var member = guild.members.cache.find(gm => gm.user.tag == action.user || gm.user.id == action.user);
    if (!member) {
        console.log("ERROR: No user found to give role");
    } else {
        var rolel = guild.roles.cache.find(role => role.name == action.rolename || role.id == action.rolename);
        if (!rolel) {
            console.log("ERROR: No role found to give role");
        } else {
            member.roles.add(rolel);
        }
    }
}

function RemoveRoleFromUser(client, action) {
    var guild = action.guild;
    console.log("removing role");
    console.log(typeof action.user);
    let removeUser = GetUserByTagOrId(guild, action.user);
    let role = guild.roles.cache.find(role => role.name == action.rolename || role.id == action.rolename);
    if (removeUser && role) {
        removeUser.roles.remove(role, action.reason).catch(console.error);
    }
}

function SetUserData_Handle(client, action) {
    var guild = action.guild;
    let mem = guild.members.cache.find(gm => gm.user.tag == action.user || gm.user.id == action.user);
    if (!userCache[mem.id]) {
        userCache[mem.id] = {};
    }
    let valToSet = null;
    if (!isNaN(action.fieldvalue)) {
        valToSet = parseInt(action.fieldvalue);
    } else {
        valToSet = action.fieldvalue;
    }
    userCache[mem.id][action.field] = valToSet;
}

module.exports.CheckUserData = function (client, action) {
    var guild = action.guild;
    let mem = guild.members.cache.find(gm => gm.user.tag == action.user || gm.user.id == action.user);
    var trueOrFalse = null;
    var valToCheck;
    if (userCache[mem.id]) {
        if (userCache[mem.id][action.field] !== null) {
            if (action.compare === "greater than") {
                if (!isNaN(action.value)) {
                    valToCheck = parseInt(action.value);
                    let currentVal = parseInt(userCache[mem.id][action.field]);
                    if (currentVal > valToCheck) {
                        trueOrFalse = true;
                    } else {
                        trueOrFalse = false;
                    }
                }
            }
            if (action.compare === "less than") {
                if (!isNaN(action.value)) {
                    valToCheck = parseInt(action.value);
                    let currentVal = parseInt(userCache[mem.id][action.field]);
                    if (currentVal < valToCheck) {
                        trueOrFalse = true;
                    } else {
                        trueOrFalse = false;
                    }
                }
            }
            if (action.compare === "equal to") {
                valToCheck = action.value;
                let currentVal = userCache[mem.id][action.field];
                if (currentVal == valToCheck) {
                    trueOrFalse = true;
                } else {
                    trueOrFalse = false;
                }
            }
            var passActions = {};

            if (trueOrFalse === true) {
                passActions.actions = action.trueActions;
                this.Event_Handle(DBS, "", 0, "", varsEToPass, passActions);
            } else {
                passActions.actions = action.falseActions;
                this.Event_Handle(DBS, "", 0, "", varsEToPass, passActions);
            }
        }
    }
};

function EditUserData(client, action) {
    var guild = action.guild;
    let mem = guild.members.cache.find(gm => gm.user.tag == action.user || gm.user.id == action.user);

    if (!userCache[mem.id]) {
        userCache[mem.id] = {};
        userCache[mem.id][action.field] = 0;
    }

    if (!userCache[mem.id][action.field]) {
        userCache[mem.id][action.field] = 0;
    }

    if (userCache[mem.id]) {
        if (userCache[mem.id][action.field] !== null) {
            let valToSet = null;
            if (!isNaN(action.value)) {
                valToSet = parseInt(action.value);
                let currentval = parseInt(userCache[mem.id][action.field]);
                if (action.oper === "+") {
                    userCache[mem.id][action.field] = currentval + valToSet;
                } else if (action.oper === "-") {
                    userCache[mem.id][action.field] -= valToSet;
                } else if (action.oper === "x") {
                    userCache[mem.id][action.field] *= valToSet;
                } else if (action.oper === "/") {
                    userCache[mem.id][action.field] /= valToSet;
                }
            }
        } else {
            console.log("field doesnt exist");
        }
    }
}

function GetUserData(client, action) {}

function ParseActionVariables(action) {
    var guild = action.guild;

    var dbsVars = {};

    dbsVars["DefaultChannel"] = Functions.getDefaultChannel(guild);
    dbsVars["guild"] = guild;
    var injectVariables = {};
    injectVariables.dbsVars = dbsVars;
    injectVariables.serverVars = serverVars[action.guild.id];
    injectVariables.tempVars = cache[action.guild.id].variables;
    injectVariables.globalVars = globalVars;

    var newaction = Object.assign({}, action);
    regex = /%%(\w+)\[([\w\s]+)\]%%/g; ///%%(.*?)%%/g;
    var regex1 = /%%(.*?)%%/g;
    var varRegex = /\${(.*?)}/g;
    // console.log(action);
    // Get the array of current variables
    Object.keys(newaction).forEach(e => {
        try {
            if (e !== "trueActions" && e !== "falseActions" && e !== "fields" && e !== "permissions" && e !== "guild") {
                var newVal = newaction[e];
                newVal = newVal.replace("$$DefaultChannel$$", Functions.getDefaultChannel(guild));
                newVal = newVal
                    .replace("$$ServerIcon$$", guild.iconURL)
                    .replace("$$MemberCount$$", guild.memberCount.toString())
                    .replace("$$JoinedAt$$", guild.joinedAt.toString())
                    .replace("$$ServerName$$", guild.name)
                    .replace("$$ServerOwner$$", guild.owner.id)
                    .replace("$$ServerRegion$$", guild.region)
                    .replace("$$VerificationLevel$$", guild.verificationLevel.toString());
                newaction[e] = newVal;
            } else if (e === "fields") {
                Array.prototype.forEach.call(newaction[e], child => {
                    var newVal = child.value;
                    newVal = newVal.replace("$$DefaultChannel$$", Functions.getDefaultChannel(guild));
                    newVal = newVal
                        .replace("$$ServerIcon$$", guild.iconURL)
                        .replace("$$MemberCount$$", guild.memberCount.toString())
                        .replace("$$JoinedAt$$", guild.joinedAt.toString())
                        .replace("$$ServerName$$", guild.name)
                        .replace("$$ServerOwner$$", guild.owner.id)
                        .replace("$$ServerRegion$$", guild.region)
                        .replace("$$VerificationLevel$$", guild.verificationLevel.toString());
                    child.value = newVal;
                });
            }
        } catch (err) {
            console.log(err);
        }
        //console.log(`key=${e}  value=${action[e]}`)
    });
    // if (cache[guild.id]) {
    //     cache[guild.id].variables.forEach(sv => {
    //         if (sv.type == "Text" || sv.type == "Number" || sv.type == "User" || sv.type == "Channel" || sv.type == "row") {
    //             vars[sv.name] = sv.value;
    //         }
    //     });
    Object.keys(newaction).forEach(e => {
        try {
            if (e !== "trueActions" && e !== "falseActions" && e !== "fields" && e !== "permissions" && e !== "guild") {
                var newVal = newaction[e].replace(regex1, function (m) {
                    var match = m.slice(2, m.toString().length - 2);
                    return getDescendantProp(injectVariables, "tempVars." + match);
                });
                newVal = newVal.replace(varRegex, function (m) {
                    var match = m.slice(2, m.toString().length - 1);
                    return getDescendantProp(injectVariables, match);
                });
                newaction[e] = newVal;
            } else if (e === "fields") {
                /*newaction[e].foreach(fieldString => {
                    consolg.log(fieldString);
                });*/
                Array.prototype.forEach.call(newaction[e], child => {
                    var newValF = child.value.replace(regex1, function (m) {
                        var match = m.slice(2, m.toString().length - 2);
                        return getDescendantProp(injectVariables, "tempVars." + match);
                    });
                    newValF = newValF.replace(varRegex, function (m) {
                        var match = m.slice(2, m.toString().length - 1);
                        return getDescendantProp(injectVariables, match);
                    });
                    child.value = newValF;
                });
            }
        } catch (err) {
            console.log(err);
        }
    });
    //}
    return newaction;
}

function getDescendantProp(obj, desc) {
    var arr = desc.split(".");
    while (arr.length) {
        obj = obj[arr.shift()];
    }
    return obj;
}

function StoreValueinVariable_Handle(client, action) {
    var variableObject = {};
    var paramValue;
    var guild = action.guild;
    // Save variable to temp/server/global vars.
    if (action.savevartype) {
        if (!serverVars[guild.id]) serverVars[guild.id] = {};
        if (!cache[guild.id]) cache[guild.id] = {};
        if (!cache[guild.id].variables) cache[guild.id].variables = {};

        var variableObject;
        if (action.savevartype === "server") {
            variableObject = serverVars[guild.id];
        } else if (action.savevartype === "global") {
            variableObject = globalVars;
        } else {
            variableObject = cache[guild.id].variables;
        }

        // Save based on the node type
        if (action.type === "Get Command Author") {
            let found = msg.author;
            paramValue = found.id;
        } else if (action.type === "Get User Data") {
            let mem = guild.members.cache.find(gm => gm.user.tag == action.user || gm.user.id == action.user);
            if (userCache[mem.id]) {
                paramValue = userCache[mem.id][action.field];
            }
        } else if (action.type === "Generate Random Number") {
            if (!isNaN(Number(action.min)) && !isNaN(Number(action.max))) {
                paramValue = Math.floor(Math.random() * (Number(action.max) - Number(action.min) + 1) + Number(action.min)).toString();

                action.vartype = "Number";
            }
        } else if (action.type === "Get Command Channel") {
            paramValue = msg.channel.name;
        } else if (action.vartype == "User") {
            let found = msg.mentions.members.first();
            paramValue = found;
        } else if (action.param == 0) {
            paramValue = msg.content.substr(msg.content.indexOf(" ") + 1);
        } else {
            paramValue = msg.content.split(" ")[action.param];
        }
        // If numeric then convert
        if (action.vartype == "number") {
            try {
                paramValue = Number(paramValue);
            } catch (err) {
                console.log("ERROR converting value: " + paramValue + " to number");
            }
        }
        variableObject[action.varname] = paramValue;
    }
}

function contains(arr, key, val) {
    for (var i = 0; i < arr.length; i++) {
        if (arr[i][key] === val) return true;
    }
    return false;
}

function GetRow_Handle(client, action) {
    var guild = action.guild;

    var objectToAdd = {};
    const csvFile = fs.readFileSync(path.resolve(__dirname, "../BotData/sheets/" + action.selectedsheet));
    const csvData = csvFile.toString();
    Papa.parse(csvData, {
        header: true,
        complete: function (results, file) {
            var foundValue = results.data.filter(obj => obj[action.colheader] === action.colval);
            if (foundValue.length > 0) {
                objectToAdd[action.rowvariable] = foundValue[0];
                if (!cache[guild.id]) cache[guild.id] = {};
                let vars = cache[guild.id];
                if (!vars.variables) vars.variables = [];
                let vararray = vars.variables;
                if (contains(vararray, "name", action.rowvariable)) {
                    var existingvar = vararray.find(vari => vari.name == action.rowvariable);
                    existingvar.value = foundValue[0];
                    existingvar.type = "row";
                } else {
                    vararray.push({
                        name: action.rowvariable,
                        value: foundValue[0],
                        type: "row"
                    });
                }
                vars.variables = vararray;
                cache[guild.id] = vars;
            } else {
                breakFailure = false;
            }
        }
    });
}

function EditVariable_Handle(client, action) {
    var guild = action.guild;

    if (!isNaN(Number(action.value))) {
        if (action.savevartype) {
            if (!serverVars[guild.id]) serverVars[guild.id] = {};
            if (!cache[guild.id]) cache[guild.id] = {};
            if (!cache[guild.id].variables) cache[guild.id].variables = {};

            var variableObject;
            if (action.savevartype === "server") {
                variableObject = serverVars[guild.id];
            } else if (action.savevartype === "global") {
                variableObject = globalVars;
            } else {
                variableObject = cache[guild.id].variables;
            }

            // Check if numeric
            var existingvar = variableObject[action.varname];
            if (existingvar) {
                if (!isNaN(Number(existingvar))) {
                    var returnValue = 0;
                    var existingValue = Number(existingvar);
                    var numberToEdit = Number(action.value);
                    if (action.oper == "+") {
                        returnValue = existingValue + numberToEdit;
                    } else if (action.oper == "-") {
                        returnValue = existingValue - numberToEdit;
                    } else if (action.oper == "x") {
                        returnValue = existingValue * numberToEdit;
                    } else {
                        returnValue = existingValue / numberToEdit;
                    }

                    variableObject[action.varname] = returnValue;
                }
            }
        }
    }
}

module.exports.CheckVariableValue_Handle = function (client, action) {
    var trueOrFalse = null;
    var guild = action.guild;

    if (action.savevartype) {
        if (!serverVars[guild.id]) serverVars[guild.id] = {};
        if (!cache[guild.id]) cache[guild.id] = {};
        if (!cache[guild.id].variables) cache[guild.id].variables = {};

        var variableObject;
        if (action.savevartype === "server") {
            variableObject = serverVars[guild.id];
        } else if (action.savevartype === "global") {
            variableObject = globalVars;
        } else {
            variableObject = cache[guild.id].variables;
        }

        var existingvar = variableObject[action.varname];
        if (existingvar) {
            if (action.compare === "greater than") {
                if (!isNaN(action.value)) {
                    valToCheck = parseInt(action.value);
                    let currentVal = existingvar;
                    if (currentVal > valToCheck) {
                        trueOrFalse = true;
                    } else {
                        trueOrFalse = false;
                    }
                }
            }
            if (action.compare === "less than") {
                if (!isNaN(action.value)) {
                    valToCheck = parseInt(action.value);
                    let currentVal = existingvar;
                    if (currentVal < valToCheck) {
                        trueOrFalse = true;
                    } else {
                        trueOrFalse = false;
                    }
                }
            }
            if (action.compare === "equal to") {
                valToCheck = action.value;
                let currentVal = existingvar;
                if (currentVal == valToCheck) {
                    trueOrFalse = true;
                } else {
                    trueOrFalse = false;
                }
            }
            var passActions = {};

            if (trueOrFalse === true) {
                passActions.actions = action.trueActions;
                this.Event_Handle(DBS, "", 0, "", varsEToPass, passActions);
            } else {
                passActions.actions = action.falseActions;
                this.Event_Handle(DBS, "", 0, "", varsEToPass, passActions);
            }
        }
    }
};

module.exports.CheckUserPermissions_Handle = function (client, action) {
    var guild = action.guild;

    var mem = GetUserByTagOrId(guild, action.user);
    var hasPerms;
    if (mem) {
        var passActions = {};
        if (action.permissions.length === 0) {
            hasPerms = true;
        } else {
            if (mem.hasPermission(action.permissions)) {
                hasPerms = true;
            } else {
                hasPerms = false;
            }
        }
        if (hasPerms) {
            passActions.actions = action.trueActions;
            this.Event_Handle(DBS, "", 0, "", varsEToPass, passActions);
        } else {
            passActions.actions = action.falseActions;
            this.Event_Handle(DBS, "", 0, "", varsEToPass, passActions);
        }
    } else {
        console.log("Member not found with tag/id: " + action.user);
    }
};

function GetUserByTagOrId(guild, tagorid) {
    // User vars stored in <@123456> format should be replaced with just the id
    if (tagorid.startsWith("<@")) {
        tagorid = tagorid.replace("<", "").replace(">", "").replace("@", "");
    }
    var mem = guild.members.cache.find(gm => gm.user.tag == tagorid || gm.user.id == tagorid);
    return mem;
}

// Console log color defs
var BgYellow = "\x1b[43m";
