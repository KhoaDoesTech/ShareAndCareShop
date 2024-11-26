// 'use strict';

// const { Client, GatewayIntentBits } = require('discord.js');

// class DiscordLogger {
//   constructor() {
//     this.client = new Client({
//       intents: [
//         GatewayIntentBits.Guilds,
//         GatewayIntentBits.GuildMessages,
//         GatewayIntentBits.GuildMessageReactions,
//         GatewayIntentBits.GuildMembers,
//         GatewayIntentBits.GuildPresences,
//       ],
//     });
//     this.channelId = process.env.DISCORD_CHANNEL_ID;
//     this.token = process.env.DISCORD_TOKEN;

//     this.client.on('ready', () => {
//       console.log(`Logged in as ${this.client.user.tag}`.green);
//     });
//     this.client.login(this.token);
//     this.start;
//   }

//   log(message) {
//     const channel = this.client.channels.cache.get(this.channelId);
//     if (!channel) {
//       console.error(`Channel not found with id ${this.channelId}`);
//       return;
//     }

//     channel.send(message).catch((err) => {
//       console.error(`Error sending message: ${err}`);
//     });
//   }
// }

// module.exports = DiscordLogger;
