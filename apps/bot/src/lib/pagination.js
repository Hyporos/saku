const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require("discord.js");
const { EMOJIS } = require("../config/ids.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// Create a pagination row with previous, next buttons and a page selector
function createPaginationRow(currentPage, maxPage) {
  const previous = new ButtonBuilder()
    .setCustomId("previous")
    .setEmoji(EMOJIS.NAV.prev)
    .setStyle(ButtonStyle.Primary)
    .setDisabled(currentPage === 1);

  const pageSelector = new ButtonBuilder()
    .setCustomId("pageSelector")
    .setLabel(`${currentPage}/${maxPage}`)
    .setStyle(ButtonStyle.Secondary);

  const next = new ButtonBuilder()
    .setCustomId("next")
    .setEmoji(EMOJIS.NAV.next)
    .setStyle(ButtonStyle.Primary)
    .setDisabled(currentPage === maxPage);

  return new ActionRowBuilder().addComponents(
    previous,
    pageSelector,
    next
  );
}

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = { createPaginationRow };