// Animated GIF prompts are served directly by GIPHY.
const gif = id => `https://media.giphy.com/media/${id}/giphy.gif`;
const pairs = [
  { citizen: gif('10JhviFuU2gWD6'), imposter: gif('5VKbvrjxpVJCM') },
  { citizen: gif('3o7TKSjRrfIPjeiVyM'), imposter: gif('j24iLwCAjAeNQgORpZ') },
  { citizen: gif('XlKvVrcIq4qAtsTFVk'), imposter: gif('10JhviFuU2gWD6') },
  { citizen: gif('5VKbvrjxpVJCM'), imposter: gif('3o7TKSjRrfIPjeiVyM') },
  { citizen: gif('j24iLwCAjAeNQgORpZ'), imposter: gif('XlKvVrcIq4qAtsTFVk') },
];
module.exports = { getRandomPair: () => pairs[Math.floor(Math.random() * pairs.length)] };
