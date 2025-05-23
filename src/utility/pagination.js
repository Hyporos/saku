const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require("discord.js");

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

// Create a pagination row with previous, next buttons and a page selector
function createPaginationRow(currentPage, maxPage) {
  const previous = new ButtonBuilder()
    .setCustomId("previous")
    .setEmoji("<:singleleftchevron:1375242927634120804>")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(currentPage === 1);

  const pageSelector = new ButtonBuilder()
    .setCustomId("pageSelector")
    .setLabel(`${currentPage}/${maxPage}`)
    .setStyle(ButtonStyle.Secondary);

  const next = new ButtonBuilder()
    .setCustomId("next")
    .setEmoji("<:singlerightchevron:1375242928787689693>")
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