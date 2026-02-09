import 'dotenv/config';
import express from 'express';
import {
  InteractionType,
  InteractionResponseType,
  InteractionResponseFlags,
  MessageComponentTypes,
  ButtonStyleTypes,
  verifyKeyMiddleware,
} from 'discord-interactions';
import { getRandomEmoji, DiscordRequest } from './utils.js';
import { getShuffledOptions, getResult } from './game.js';
import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ]
});

client.login(process.env.DISCORD_TOKEN);

const VOICE_LOG_CHANNEL_ID = "1467108826217058471";
// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;

// Store for in-progress games. In production, you'd want to use a DB
const activeGames = {};
console.log("Bot started!");
/**
 * Interactions endpoint URL where Discord will send HTTP requests
 * Parse request body and verifies incoming requests using discord-interactions package
 */
client.on("voiceStateUpdate", async (oldState, newState) => {
  const member = newState.member ?? oldState.member;
  if (!member || member.user.bot) return;
  const logChannel = newState.guild.channels.cache.get(VOICE_LOG_CHANNEL_ID);
  if (!logChannel) {
	  console.log("Failed to find log channel");
	  return;
  }

  let action = null;
  let description = null;

  // Joined
  if (!oldState.channel && newState.channel) {
    action = "Voice Join";
    description = `**User:** ${member}\n**Channel:** ${newState.channel}`;
	console.log("User joined the voice channel!");
  }

  // Left
  else if (oldState.channel && !newState.channel) {
    action = "Voice Leave";
    description = `**User:** ${member}\n**Channel:** ${oldState.channel}`;
	console.log("User left the voice channel!");
  }

  // Moved
  else if (
    oldState.channel &&
    newState.channel &&
    oldState.channel.id !== newState.channel.id
  ) {
    action = "Voice Move";
    description =
      `**User:** ${member}\n` +
      `**From:** ${oldState.channel}\n` +
      `**To:** ${newState.channel}`;
	  console.log("User moved to another voice channel!");
  }

  if (!action) return;

  const embed = new EmbedBuilder()
    .setTitle(action)
    .setDescription(description)
    .setColor(0x5865F2)
    .setTimestamp();

  logChannel.send({ embeds: [embed] }).catch(() => {});
});

app.post('/interactions', verifyKeyMiddleware(process.env.PUBLIC_KEY), async function (req, res) {
  // Interaction type and data
  const { type, id, data } = req.body;

  /**
   * Handle verification requests
   */
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  /**
   * Handle slash command requests
   * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
   */
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    // "test" command
    if (name === 'test') {
      // Send a message into the channel where command was triggered from
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.IS_COMPONENTS_V2,
          components: [
            {
              type: MessageComponentTypes.TEXT_DISPLAY,
              // Fetches a random emoji to send from a helper function
              content: `pong`
            }
          ]
        },
      });
    }

  // "userinfo" command
  if (name === 'userinfo') {
    const targetUser =
      options?.find(opt => opt.name === 'user')?.value ||
      req.body.member.user.id;

    const user =
      req.body.resolved?.users?.[targetUser] ||
      req.body.member.user;

    const member =
      req.body.resolved?.members?.[targetUser] ||
      req.body.member;

    const createdAt = new Date(
      Number(BigInt(user.id) >> 22n) + 1420070400000
    );

    const joinedAt = member?.joined_at
      ? new Date(member.joined_at)
      : null;

    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: [
          `**User Info**`,
          ``,
          `**Username:** ${user.username}#${user.discriminator}`,
          `**User ID:** ${user.id}`,
          `**Bot:** ${user.bot ? 'Yes' : 'No'}`,
          `**Account Created:** ${createdAt.toUTCString()}`,
          joinedAt ? `**Joined Server:** ${joinedAt.toUTCString()}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
      },
	});
  }
  
  console.error('unknown interaction type', type);
  return res.status(400).json({ error: 'unknown interaction type' });
  }
});

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
