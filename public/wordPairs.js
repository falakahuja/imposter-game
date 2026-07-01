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
  ];

  function getRandomPair() {
    return wordPairs[Math.floor(Math.random() * wordPairs.length)];
  }

  return { wordPairs, getRandomPair };
});