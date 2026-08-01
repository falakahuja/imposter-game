(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js / server-side
    module.exports = factory();
  } else {
    // Browser
    root.WordPairs = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const wordPairs = [
    { citizen: 'Beach', imposter: 'Desert' },
    { citizen: 'Coffee', imposter: 'Tea' },
    { citizen: 'Doctor', imposter: 'Nurse' },
    { citizen: 'Guitar', imposter: 'Violin' },
    { citizen: 'Pizza', imposter: 'Burger' },
    { citizen: 'Snow', imposter: 'Rain' },
    { citizen: 'Library', imposter: 'Bookstore' },
    { citizen: 'Airplane', imposter: 'Helicopter' },
    { citizen: 'Football', imposter: 'Rugby' },
    { citizen: 'Castle', imposter: 'Palace' },
    { citizen: 'Lake', imposter: 'River' },
    { citizen: 'Cat', imposter: 'Dog' },
    { citizen: 'Painter', imposter: 'Sculptor' },
    { citizen: 'Volcano', imposter: 'Earthquake' },
    { citizen: 'Sushi', imposter: 'Ramen' },
    { citizen: 'Batman', imposter: 'Superman' },
    { citizen: 'Netflix', imposter: 'YouTube' },
    { citizen: 'Elevator', imposter: 'Escalator' },
    { citizen: 'Karaoke', imposter: 'Concert' },
    { citizen: 'Pancakes', imposter: 'Waffles' },
    { citizen: 'WiFi', imposter: 'Bluetooth' },
    { citizen: 'Mermaid', imposter: 'Pirate' },
    { citizen: 'Popcorn', imposter: 'Nachos' },
    { citizen: 'Camping', imposter: 'Glamping' },
    { citizen: 'Taxi', imposter: 'Uber' },
    { citizen: 'Unicorn', imposter: 'Dragon' },
    { citizen: 'Emoji', imposter: 'Sticker' },
    { citizen: 'Rollercoaster', imposter: 'Ferris Wheel' },
    { citizen: 'Cereal', imposter: 'Oatmeal' },
    { citizen: 'Instagram', imposter: 'TikTok' },
    { citizen: 'Magician', imposter: 'Clown' },
    { citizen: 'Alien', imposter: 'Robot' },
    { citizen: 'Bubble Tea', imposter: 'Milkshake' },
    { citizen: 'Board Game', imposter: 'Video Game' },
    { citizen: 'Dinosaur', imposter: 'Monster' },
  ];

  function getRandomPair() {
    return wordPairs[Math.floor(Math.random() * wordPairs.length)];
  }

  return { wordPairs, getRandomPair };
});
