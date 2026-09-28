// Medalya: achievements earned from what happened in one game. Pure; the page stores the unlocked set.
export const MEDALS = [
  { id: 'unang-kagat', name: 'Unang Kagat', desc: 'Eat your first street food', test: (g) => g.eaten >= 1 },
  { id: 'busog', name: 'Busog', desc: 'Grow to 25 segments', test: (g) => g.snake.length >= 25 },
  { id: 'sunod-sunod', name: 'Sunod-sunod', desc: 'Chain a combo of 5', test: (g) => g.bestCombo >= 5 },
  { id: 'suwerte', name: 'Suwerte', desc: 'Eat a balut', test: (g) => (g.counts.balut || 0) >= 1 },
  { id: 'anghang', name: 'Anghang!', desc: 'Eat 3 sili in one game', test: (g) => (g.counts.sili || 0) >= 3 },
  { id: 'tinikling', name: 'Tinikling Master', desc: 'Live through 5 claps', test: (g) => g.claps >= 5 },
  { id: 'barangay-5', name: 'Barangay 5', desc: 'Reach the fifth barangay', test: (g) => g.level >= 5 },
  { id: 'anting', name: 'May Anting-anting', desc: 'Get saved by an amulet', test: (g) => g.saves >= 1 },
  { id: 'walang-pader', name: 'Walang Pader', desc: 'Score 500 in Walang Pader', test: (g) => g.mode === 'walangpader' && g.score >= 500 },
  { id: 'sanlibo', name: 'Sanlibo', desc: 'Score 1,000 in one game', test: (g) => g.score >= 1000 },
];

export const earned = (g) => MEDALS.filter((m) => m.test(g)).map((m) => m.id);
