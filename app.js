// Full application restored in ordered parts to avoid truncation.
// Load part 1 first; it loads parts 2 and 3 synchronously in sequence.
document.write('<script src="app-part1.js"><\/script><script src="app-part2.js"><\/script><script src="app-part3.js"><\/script>');