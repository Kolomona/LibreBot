import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import sqlite3 from "sqlite3";

const db = new sqlite3.Database('karmadb.sqlite');
const token = process.env.T_API_TOKEN;
const bot = new TelegramBot(token, { polling: true });


bot.on('message', async (msg) => {
    if (!msg.text) {
        return
    }
    console.log("checking command", msg.text.toString());

    const command = checkCommand(msg);
    console.log("Command is: " + command);

    switch (command) {
        case false:
            return;
        case "karma":
            processKarma(msg);
            console.log("Karma");
            break;
        case "hi":
            processHi(msg);
            console.log("Hi");
            break;
        case "help":
            processHelp(msg);
            console.log("Help!");
            break;
        case "karmaStats":
            processKarmaStats(msg);
            console.log("KarmaStats");
            break;
        default:
            return
    }

    return;






});



function checkCommand(msg) {
    // Check to see if there's a valid command in the message. If not bail quickly

    // console.log("checkCommand - message:\n", msg);


    const message = msg.text.toString();
    const words = message.split(" ");

    // Check for karma
    const karmaTest = words.find(word => word.endsWith("++") || word.endsWith("--") || word.endsWith("—"));
    if (karmaTest) {
        return "karma";
    }

    // Check for karmaStats
    if (words[0] === "!karma" && words[1].length > 0) {
        return "karmaStats";
    }

    // Check for help
    if (words[0].toLowerCase() === "!help") {
        return "help";

    }

    // Check for Hi command
    if (msg.text.toString().toLowerCase().indexOf("hi") === 0) {
        return "hi";
    }

    // Check for KarmaStats
    if (message.toLowerCase().startsWith("!karmastats")) {
        return "karmaStats";
    }

    return false;
}

async function processKarma(msg) {
    const messageText = msg.text.toString();
    console.log("Processing Karma message: ", msg);
    let karmaType = "";
    let karmaName = "";

    // console.log("msg:", msg);
    if (messageText.includes("++")) {
        karmaType = "plusplus";
        // console.log("plusplus ", karmaType);
    } else if (messageText.match(/--|—/)) {
        karmaType = "minusminus";
        // console.log("minusminus ", karmaType);
    }

    const messageArray = messageText.split(" ");
    if (messageArray.length > 1) {
        // get word that contains ++
        karmaName = messageArray.find(word => word.includes("++") || word.includes("--"));
    } else {
        karmaName = messageText;
    }

    //karmaName = karmaName.replace("++", "").replace("@", "").replace("--", "").replace("—", "");
    karmaName = (karmaName ?? messageText).replace("++", "").replace("@", "").replace("--", "").replace("—", "");

    // Add karma to the database
    let karmaSum = 0;
    let plusplus = 0;
    let minusminus = 0;

    // Insert or ignore a new record
    db.run('INSERT OR IGNORE INTO karma (name) VALUES (?)', [karmaName]);

    // If the karmaType is "plusplus" then increment the plusplus field
    if (karmaType === 'plusplus') {
        db.run('UPDATE karma SET plusplus = COALESCE(plusplus, 0) + 1 WHERE name = ?', [karmaName]);
    } else if (karmaType === 'minusminus') {
        db.run('UPDATE karma SET minusminus = COALESCE(minusminus, 0) + 1 WHERE name = ?', [karmaName]);
    }

    // Get the values of the plusplus field and the minusminus field
    const row = await new Promise((resolve, reject) => {
        db.get('SELECT plusplus, minusminus FROM karma WHERE name = ?', [karmaName], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });


    if (row) {
        plusplus = row.plusplus;
        minusminus = row.minusminus;
        karmaSum = plusplus - minusminus;
    } else {
        console.error('row is undefined');
        // handle the error
    }


    // handle possesive apostophes properly
    const reply = `${karmaName}${karmaName.toLowerCase().endsWith("s") ? "'" : "'s"} karma is now ${karmaSum}`;
    bot.sendMessage(msg.chat.id, reply);

    return;
}

function processHi(msg) {
    bot.sendMessage(msg.chat.id, "Hello");
}

function processHelp(msg) {
    console.log("Processing Help message");

    const reply =
        `I am a simple KarmaBot inspired by gal.

    The commands that I know are:

    [name]++ or [name]--
    !karmaStats [name]
    !help`;
    console.log("Reply is: ", reply);


    bot.sendMessage(msg.chat.id, reply);
}


function processKarmaStats(msg) {
    let plusplus = 5;
    let minusminus = 2;


    const karmaName = msg.text.toString().split(" ")[1];
    console.log(msg.text.toString().split(" "));

    const reply =
        `${karmaName} has received karma ${plusplus + minusminus} times.
${plusplus} positive karma and ${minusminus} negative karma.
for a total karma of ${plusplus - minusminus}.`;

    bot.sendMessage(msg.chat.id, reply);
}