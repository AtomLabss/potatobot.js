const { Client, Intents, MessageActionRow, Modal, TextInputComponent } = require('discord.js');
const { isNotBlacklisted, commandNotDisabled } = require('./utils/Checks');
const { CodeModal } = require('./ui/code');

class Code {
    constructor(client) {
        this.client = client;
        this.name = "💻 Code";
    }

    async run(interaction) {
        if (!interaction.isCommand()) {
            await interaction.reply("This command can only be used as a slash command.");
            return;
        }

        const modal = new Modal()
            .setCustomId('codeModal')
            .setTitle('Run Code')
            .addComponents(
                new MessageActionRow().addComponents(
                    new TextInputComponent()
                        .setCustomId('codeInput')
                        .setLabel("Enter your code")
                        .setStyle('PARAGRAPH')
                )
            );

        await interaction.showModal(modal);
    }
}

module.exports = {
    name: 'code',
    description: 'Run code in (almost) any language, a modal will pop up',
    usage: 'code',
    async execute(interaction) {
        if (!await isNotBlacklisted(interaction.user)) {
            await interaction.reply("You are blacklisted from using this command.");
            return;
        }

        if (!await commandNotDisabled('code')) {
            await interaction.reply("This command is currently disabled.");
            return;
        }

        const codeCommand = new Code(interaction.client);
        await codeCommand.run(interaction);
    },
    setup(client) {
        client.on('interactionCreate', async (interaction) => {
            if (!interaction.isCommand() || interaction.commandName !== 'code') return;
            await module.exports.execute(interaction);
        });
    }
};
