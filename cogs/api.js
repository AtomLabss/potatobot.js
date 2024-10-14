// This project is licensed under the terms of the GPL v3.0 license. All credits, and copyright goes to Cyteon.

const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const fetch = require('node-fetch');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const commands = [
    new SlashCommandBuilder()
        .setName('api')
        .setDescription('Commands for different APIs')
        .addSubcommand(subcommand =>
            subcommand
                .setName('minecraft')
                .setDescription('Get someone\'s Minecraft character')
                .addStringOption(option => option.setName('username').setDescription('Minecraft username').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('mc-server')
                .setDescription('Get info on a Minecraft server')
                .addStringOption(option => option.setName('host').setDescription('Server host').setRequired(true)))
];

const rest = new REST({ version: '9' }).setToken('YOUR_BOT_TOKEN');

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationGuildCommands('YOUR_CLIENT_ID', 'YOUR_GUILD_ID'),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();

client.once('ready', () => {
    console.log('Ready!');
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName, options } = interaction;

    if (commandName === 'api') {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'minecraft') {
            const username = options.getString('username');
            const embed = new EmbedBuilder()
                .setTitle(`Minecraft character for ${username}`)
                .setColor(0xBEBEFE)
                .setImage(`https://mc-heads.net/body/${username}`);

            await interaction.reply({ embeds: [embed] });
        } else if (subcommand === 'mc-server') {
            const host = options.getString('host');
            const response = await fetch(`https://api.mcsrvstat.us/3/${host}`);
            const data = await response.json();

            if (data.online) {
                const embed = new EmbedBuilder()
                    .setTitle(`Server info for ${host}`)
                    .setColor(0xBEBEFE)
                    .addFields(
                        { name: 'Players', value: `\`\`\`${data.players.online}/${data.players.max}\`\`\``, inline: false },
                        { name: 'Version', value: `\`\`\`${data.version}${data.software ? ` (${data.software})` : ''}\`\`\``, inline: false },
                        { name: 'MOTD', value: `\`\`\`${data.motd.clean[0]}\`\`\``, inline: false }
                    );

                if (data.players.list) {
                    const players = data.players.list.map(p => p.name).join(', ');
                    embed.addFields({ name: 'Online players', value: `\`\`\`${players}\`\`\``, inline: false });
                }

                if (data.plugins) {
                    const plugins = data.plugins.map(p => p.name).join(', ');
                    embed.addFields({ name: 'Plugins', value: `\`\`\`${plugins}\`\`\``, inline: false });
                }

                if (data.mods) {
                    const mods = data.mods.map(m => m.name).join(', ');
                    embed.addFields({ name: 'Mods', value: `\`\`\`${mods}\`\`\``, inline: false });
                }

                await interaction.reply({ embeds: [embed] });
            } else {
                await interaction.reply('The server is offline');
            }
        }
    }
});

client.login('YOUR_BOT_TOKEN');
