// This project is licensed under the terms of the GPL v3.0 license. All credits, and copyright goes to Cyteon.

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Client, Intents } = require('discord.js');
const mongoose = require('mongoose');

dotenv.config();

const app = express();
app.use(express.json());

const configPath = path.join(__dirname, 'config.json');
if (!fs.existsSync(configPath)) {
    console.error("'config.json' not found! Please add it and try again.");
    process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const origins = config.origins;

app.use(cors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const guildSchema = new mongoose.Schema({
    id: String,
    data: Object
});

const userSchema = new mongoose.Schema({
    id: String,
    data: Object
});

const Guild = mongoose.model('Guild', guildSchema);
const User = mongoose.model('User', userSchema);

app.get('/', (req, res) => {
    res.json({ message: `User: ${client.user.username} is online!` });
});

app.get('/api', (req, res) => {
    res.json({ message: 'OK' });
});

app.get('/api/commands/:cog?', (req, res) => {
    const cog = req.params.cog || 'all';
    if (cog === 'all') {
        const allCommands = client.commands.map(cmd => ({
            name: cmd.name,
            description: cmd.description,
            usage: cmd.usage,
            aliases: cmd.aliases,
            subcommand: cmd.parent !== null,
            extras: cmd.extras
        }));
        res.json(allCommands);
    } else {
        const commands = client.commands.filter(cmd => cmd.cog === cog);
        if (commands.length === 0) {
            res.status(404).json({ message: 'Cog not found.' });
        } else {
            res.json(commands);
        }
    }
});

app.get('/api/cogs', (req, res) => {
    const cogs = Array.from(client.cogs.keys()).filter(cog => cog !== 'owner');
    res.json(cogs);
});

app.get('/api/guild/:id', async (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) {
        res.status(404).json({ message: 'Guild not found.' });
        return;
    }

    let guildData = await Guild.findOne({ id: guild.id });
    if (!guildData) {
        guildData = new Guild({ id: guild.id, data: {} });
        await guildData.save();
    }

    res.json({
        name: guild.name,
        id: guild.id,
        dbdata: JSON.stringify(guildData.data),
        members: guild.memberCount,
        channels: guild.channels.cache.size,
        roles: guild.roles.cache.size
    });
});

app.get('/api/user/:id', async (req, res) => {
    const user = await client.users.fetch(req.params.id);
    if (!user) {
        res.status(404).json({ message: 'User not found.' });
        return;
    }

    let userData = await User.findOne({ id: user.id });
    if (!userData) {
        userData = new User({ id: user.id, data: {} });
        await userData.save();
    }

    if (userData.data.blacklisted) {
        res.status(403).json({ message: 'User is blacklisted.', reason: userData.data.blacklist_reason });
        return;
    }

    const mutualGuilds = client.guilds.cache.filter(guild => guild.members.cache.has(user.id));
    const guilds = mutualGuilds.map(guild => ({
        name: guild.name,
        id: guild.id,
        members: guild.memberCount
    }));

    res.json({
        name: user.username,
        id: user.id,
        guilds: guilds
    });
});

app.get('/api/stats', (req, res) => {
    res.json({
        commands_ran: client.stats.commands_ran,
        users: client.users.cache.size,
        ai_requests: client.stats.ai_requests
    });
});

const PORT = config.port || 3000;
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.login(process.env.TOKEN);
