// This project is licensed under the terms of the GPL v3.0 license. All credits, and copyright goes to Cyteon.

const { Client, Intents, Collection, MessageEmbed, WebhookClient } = require('discord.js');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const winston = require('winston');
const PickleDB = require('pickledb');
const { setTimeout } = require('timers/promises');

dotenv.config();

if (!fs.existsSync(path.join(__dirname, 'config.json'))) {
    console.error("'config.json' not found! Please add it and try again.");
    process.exit(1);
}

const config = require(path.join(__dirname, 'config.json'));

const client = new Client({
    intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_MEMBERS]
});

const mongoClient = new MongoClient(process.env.MONGODB_URL);
let db;

const prefixDB = PickleDB.create('pickle/prefix.db', false);
const statsDB = PickleDB.create('pickle/stats.db', false);

const cantReactIn = [];

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`)
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'discord.log' })
    ]
});

client.commands = new Collection();

const loadCommands = () => {
    const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const command = require(path.join(__dirname, 'commands', file));
        client.commands.set(command.name, command);
    }
};

const loadEvents = () => {
    const eventFiles = fs.readdirSync(path.join(__dirname, 'events')).filter(file => file.endsWith('.js'));
    for (const file of eventFiles) {
        const event = require(path.join(__dirname, 'events', file));
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client));
        }
    }
};

client.once('ready', async () => {
    logger.info(`Logged in as ${client.user.tag}`);
    logger.info(`discord.js API version: ${require('discord.js').version}`);
    logger.info(`Node.js version: ${process.version}`);
    logger.info(`Running on: ${process.platform} ${process.arch}`);

    try {
        await mongoClient.connect();
        db = mongoClient.db('potatobot');
        logger.info(`Connection to db successful: ${mongoClient.s.url}`);
    } catch (error) {
        logger.error(`Failed to connect to the database: ${error}`);
    }

    loadCommands();
    loadEvents();

    setInterval(() => {
        const statuses = ['youtube', 'netflix'];
        client.user.setActivity(statuses[Math.floor(Math.random() * statuses.length)], { type: 'WATCHING' });
    }, 60000);
});

client.on('guildCreate', async guild => {
    const webhookClient = new WebhookClient({ url: config.join_leave_webhook });
    const embed = new MessageEmbed()
        .setTitle('Bot joined a guild!')
        .setDescription(`**Guild Name:** ${guild.name}\n**Guild ID:** ${guild.id}\n**Owner:** ${guild.owner ? guild.owner.user.tag : 'Unknown'}\n**Member Count:** ${guild.memberCount}`)
        .setColor('GREEN');

    await webhookClient.send({
        username: 'PotatoBot - Guild Logger',
        embeds: [embed]
    });

    logger.info(`Bot joined guild: ${guild.name}`);
});

client.on('guildDelete', async guild => {
    const webhookClient = new WebhookClient({ url: config.join_leave_webhook });
    const embed = new MessageEmbed()
        .setTitle('Bot left a guild!')
        .setDescription(`**Guild Name:** ${guild.name}\n**Guild ID:** ${guild.id}\n**Owner:** ${guild.owner ? guild.owner.user.tag : 'Unknown'}\n**Member Count:** ${guild.memberCount}`)
        .setColor('RED');

    await webhookClient.send({
        username: 'PotatoBot - Guild Logger',
        embeds: [embed]
    });

    logger.info(`Bot left guild: ${guild.name}`);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const prefix = prefixDB.get(message.guild.id) || config.prefix;
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName) || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));
    if (!command) return;

    try {
        await command.execute(message, args);
        logger.info(`Executed ${commandName} command in ${message.guild.name} (ID: ${message.guild.id}) by ${message.author.tag} (ID: ${message.author.id})`);

        const commandsRan = (statsDB.get('commands_ran') || 0) + 1;
        statsDB.set('commands_ran', commandsRan);
        statsDB.save();
    } catch (error) {
        logger.error(`Error executing ${commandName} command: ${error}`);
        await message.reply({ content: 'There was an error trying to execute that command!', ephemeral: true });
    }
});

client.login(process.env.TOKEN);
