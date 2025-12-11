import { ButtonInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const ACCENT_COLOR = 0x6366f1; // Indigo color for mystical feel
const FOOTER_TEXT = 'The Underlog · Field Guide';
const TOTAL_PAGES = 9;

/**
 * Get all embeds for the field guide
 */
function getAllEmbeds(): EmbedBuilder[] {
  const introEmbed = new EmbedBuilder()
    .setTitle('🌿 Welcome to the Underlog')
    .setDescription(
      'The Underlog is a hidden realm beneath reality—a place where Rovers dare to explore. ' +
      'When you send your Rover on expeditions into different biomes, they may return with powerful artifacts ' +
      'or come back empty-handed. Everything in this world—explorations, parties, inventories, and airdrops—' +
      'is woven into the fabric of the Underlog.'
    )
    .setColor(ACCENT_COLOR)
    .setFooter({ text: `${FOOTER_TEXT} · Page 1 of ${TOTAL_PAGES}` });

  const howEmbed = new EmbedBuilder()
    .setTitle('🧭 How Explorations Work')
    .setDescription(
      'To begin your journey, use `/explore` to start a new expedition. You\'ll choose a biome to explore ' +
      'and how long your Rover should venture forth.\n\n' +
      'While your Rover is exploring, it cannot start another expedition—patience is key in the Underlog.\n\n' +
      'When the timer completes, the bot rolls for discovery:\n' +
      '• Whether an item was found\n' +
      '• The rarity of that item\n\n' +
      'Sometimes Rovers return empty-handed—this is intentional, keeping rare finds truly special.'
    )
    .setColor(ACCENT_COLOR)
    .setFooter({ text: `${FOOTER_TEXT} · Page 2 of ${TOTAL_PAGES}` });

  const biomesEmbed = new EmbedBuilder()
    .setTitle('🌍 Biome Choices')
    .setDescription(
      'The Underlog contains distinct regions, each with its own mysteries:\n\n' +
      '**💠 Crystal Caverns**\n' +
      'Cold, echoing tunnels full of prisms and unstable light. Secrets shimmer in every facet.\n\n' +
      '**🌲 Withered Woods**\n' +
      'Twisted trees, old roots, and strange whispers in the soil. Ancient memories linger here.\n\n' +
      '**🏺 Rainforest Ruins**\n' +
      'Overgrown stone, lost relics, and hidden water channels. Past civilizations whisper their tales.\n\n' +
      'Each biome offers different item pools and rarity weights. True explorers venture into all realms over time.'
    )
    .setColor(ACCENT_COLOR)
    .setFooter({ text: `${FOOTER_TEXT} · Page 3 of ${TOTAL_PAGES}` });

  const raritiesEmbed = new EmbedBuilder()
    .setTitle('💎 Item Rarities')
    .setDescription(
      'Items in the Underlog are classified by their rarity—a measure of how deep and far your Rover ventured:\n\n' +
      '**⚪ Common** – Simple curios and flavor items from the surface layers.\n\n' +
      '**🍃 Uncommon** – Useful artifacts found slightly deeper in the Underlog.\n\n' +
      '**✨ Rare** – Meaningful treasures from the deeper layers where few Rovers tread.\n\n' +
      '**💎 Legendary** – Extremely rare finds with powerful signals from the deepest reaches.\n\n' +
      '**🌟 Epic** – The rarest of discoveries, fragments of ancient power.\n\n' +
      'Remember: rarity reflects how often something appears, not your skill as an explorer.'
    )
    .setColor(ACCENT_COLOR)
    .setFooter({ text: `${FOOTER_TEXT} · Page 4 of ${TOTAL_PAGES}` });

  const durationEmbed = new EmbedBuilder()
    .setTitle('⏳ Duration & Odds')
    .setDescription(
      'The longer your Rover wanders, the deeper they venture—and the better their chances of finding something rare.\n\n' +
      '**Duration Multipliers:**\n' +
      '```\n' +
      '30 seconds → Quick test (x0.5)\n' +
      '1 hour     → Base odds (x0.5)\n' +
      '3 hours    → Better odds (x1.0)\n' +
      '6 hours    → Even better (x2.0)\n' +
      '12 hours   → High commitment (x4.0)\n' +
      '```\n\n' +
      'The longer your Rover is willing to wander, the better its chances of stumbling into something rare. ' +
      'Each expedition is a calculated risk—will you commit to a longer journey for better odds?'
    )
    .setColor(ACCENT_COLOR)
    .setFooter({ text: `${FOOTER_TEXT} · Page 5 of ${TOTAL_PAGES}` });

  const partyEmbed = new EmbedBuilder()
    .setTitle('🛡️ Party Expeditions')
    .setDescription(
      'Adventure is better shared. Form a party with up to 5 explorers using `/party create`.\n\n' +
      'When you venture together:\n' +
      '• Everyone shares the same final result—success or miss\n' +
      '• Party runs apply bonuses to item discovery odds\n' +
      '• Better chances for Uncommon, Rare, Legendary, and Epic finds\n\n' +
      'This mechanic rewards social play and makes big discoveries feel communal. ' +
      'After a party expedition is created, others can join to increase your collective odds.'
    )
    .setColor(ACCENT_COLOR)
    .setFooter({ text: `${FOOTER_TEXT} · Page 6 of ${TOTAL_PAGES}` });

  const cooldownEmbed = new EmbedBuilder()
    .setTitle('🕒 Cooldowns')
    .setDescription(
      'After your Rover returns from an expedition, there\'s a cooldown before they can venture forth again.\n\n' +
      'Cooldowns serve an important purpose:\n' +
      '• They keep items scarce and meaningful\n' +
      '• They make each decision—biome and duration—feel weighty\n' +
      '• They prevent exhaustion in the Underlog\n\n' +
      'Party expeditions share cooldown logic across everyone who participated. ' +
      'The Underlog respects rest and reflection between journeys.'
    )
    .setColor(ACCENT_COLOR)
    .setFooter({ text: `${FOOTER_TEXT} · Page 7 of ${TOTAL_PAGES}` });

  const inventoryEmbed = new EmbedBuilder()
    .setTitle('🎒 Inventory & Prizes')
    .setDescription(
      'View your collection with `/inventory` to see:\n\n' +
      '• All items you\'ve discovered\n' +
      '• Your total exploration count\n' +
      '• Your longest exploration streak\n' +
      '• Your highest rarity ever found\n\n' +
      'As your collection grows, certain items or milestones may unlock:\n' +
      '• Special roles or titles\n' +
      '• Future perks and privileges\n' +
      '• Off-chain or on-chain rewards\n\n' +
      'Every artifact tells a story of your journeys into the Underlog.'
    )
    .setColor(ACCENT_COLOR)
    .setFooter({ text: `${FOOTER_TEXT} · Page 8 of ${TOTAL_PAGES}` });

  const airdropsEmbed = new EmbedBuilder()
    .setTitle('🔗 Airdrops & Wallets')
    .setDescription(
      'Link your Ethereum wallet using `/wallet` to register for future rewards.\n\n' +
      'Your address may be used for airdrops based on:\n' +
      '• Items you\'ve discovered\n' +
      '• Distances your Rover has traveled\n' +
      '• Participation in special events\n\n' +
      '**Important:** Nothing is minted automatically. This is simply how you register where future rewards might be sent. ' +
      'The Underlog remembers those who explore deeply.'
    )
    .setColor(ACCENT_COLOR)
    .setFooter({ text: `${FOOTER_TEXT} · Page 9 of ${TOTAL_PAGES}` });

  return [
    introEmbed,
    howEmbed,
    biomesEmbed,
    raritiesEmbed,
    durationEmbed,
    partyEmbed,
    cooldownEmbed,
    inventoryEmbed,
    airdropsEmbed,
  ];
}

/**
 * Create navigation buttons for the field guide
 */
function createNavigationButtons(currentPage: number): ActionRowBuilder<ButtonBuilder> {
  const prevButton = new ButtonBuilder()
    .setCustomId(`how_nav_prev_${currentPage}`)
    .setLabel('◀ Previous')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(currentPage === 1);

  const nextButton = new ButtonBuilder()
    .setCustomId(`how_nav_next_${currentPage}`)
    .setLabel('Next ▶')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(currentPage === TOTAL_PAGES);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, nextButton);
}

/**
 * Handle navigation button clicks for /how command
 */
export async function handleHowNavigation(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferUpdate();

  // Parse current page from custom ID (format: how_nav_prev_2 or how_nav_next_2)
  const customId = interaction.customId;
  const match = customId.match(/how_nav_(prev|next)_(\d+)/);
  
  if (!match) {
    return;
  }

  const direction = match[1]; // 'prev' or 'next'
  const currentPage = parseInt(match[2], 10);

  // Calculate new page
  let newPage = currentPage;
  if (direction === 'prev' && currentPage > 1) {
    newPage = currentPage - 1;
  } else if (direction === 'next' && currentPage < TOTAL_PAGES) {
    newPage = currentPage + 1;
  }

  // Get all embeds and navigation buttons
  const embeds = getAllEmbeds();
  const embed = embeds[newPage - 1];
  const buttons = createNavigationButtons(newPage);

  // Update the message
  await interaction.editReply({
    embeds: [embed],
    components: [buttons],
  });
}

/**
 * Get the first embed with navigation buttons for initial display
 */
export function getInitialHowDisplay(): { embed: EmbedBuilder; buttons: ActionRowBuilder<ButtonBuilder> } {
  const embeds = getAllEmbeds();
  return {
    embed: embeds[0],
    buttons: createNavigationButtons(1),
  };
}

