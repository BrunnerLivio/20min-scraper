// @ts-check

/**
 * 
 * @param {string} reaction 
 */
function parseReaction(reaction) {
  const votes = parseInt(reaction.split('(')[1].split(')')[0])
  const reactionName = reaction.split(':')[0].trim().toLowerCase().replace(/ /g, '_')
  return [reactionName, votes]
}

async function parseComment(comment) {
  const author = comment.querySelector(".authorNickname")?.textContent;
  const createdAt = comment.querySelector(".createdAt")?.textContent;
  const content = comment.querySelector(":scope > div > p")?.textContent;
  const reactionsTitles = Array.from(
    comment.querySelectorAll(
      "[class*='commentReactionGraph_graph__']"
    )
  ).map((el) => el.getAttribute("title"));
  const subComments = Array.from(comment.querySelectorAll("article"));


  let reactions = {
    reactions_quatsch: 0,
    reactions_unnoetig: 0,
    reactions_genau: 0,
    reactions_love_it: 0,
    reactions_smart: 0,
    reactions_so_nicht: 0,
  }

  reactionsTitles.forEach((reaction) => {
    const [reactionName, votes] = parseReaction(reaction)
    reactions = {
      ...reactions,
      ['reactions_' + reactionName]: votes
    }
  })

  return {
    author,
    createdAt,
    content,
    subComments: await Promise.all(
      subComments
        .map(async (comment) => await parseComment(comment))
        .filter(Boolean)
    ),
    ...reactions,
  };
}

window.parseComment = parseComment;