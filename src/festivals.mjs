// Each barangay is a Philippine festival: its name and place, the colors woven into the banig, the
// bunting, a tint over the mat, and an accent for the page behind the board. Pure data; the renderer
// paints it, the rules only name it.
export const FESTIVALS = [
  { name: 'Fiesta', accent: '#4a1760', place: 'sa barangay', bands: ['#c2185b', '#00897b', '#f9a825', '#c2185b'], flags: ['#ce1126', '#fcd116', '#0038a8', '#ff6fb5', '#2ec4b6', '#ff9f1c', '#f4f1e8'], tint: null },
  { name: 'Pahiyas', accent: '#1f5a2a', place: 'Lucban, Quezon', bands: ['#e53935', '#43a047', '#fdd835', '#8e24aa'], flags: ['#e53935', '#43a047', '#fdd835', '#ff7043', '#8e24aa', '#29b6f6'], tint: 'rgba(120,200,90,0.09)' },
  { name: 'Sinulog', accent: '#6a1a12', place: 'Cebu', bands: ['#d32f2f', '#fbc02d', '#d32f2f', '#fbc02d'], flags: ['#d32f2f', '#fbc02d', '#ffffff', '#ff8f00', '#c62828'], tint: 'rgba(255,190,40,0.09)' },
  { name: 'Panagbenga', accent: '#6a1f4a', place: 'Baguio', bands: ['#ec407a', '#ab47bc', '#66bb6a', '#ffa726'], flags: ['#f48fb1', '#ce93d8', '#81c784', '#ffcc80', '#fff59d'], tint: 'rgba(240,120,180,0.09)' },
  { name: 'MassKara', accent: '#3d1f6e', place: 'Bacolod', bands: ['#ffd54f', '#7e57c2', '#26c6da', '#ef5350'], flags: ['#ffd54f', '#7e57c2', '#26c6da', '#ef5350', '#ffffff'], tint: 'rgba(150,90,220,0.11)' },
  { name: 'Ati-Atihan', accent: '#3a1a0e', place: 'Kalibo, Aklan', bands: ['#212121', '#e64a19', '#ffb300', '#212121'], flags: ['#212121', '#e64a19', '#ffb300', '#6d4c41', '#fff8e1'], tint: 'rgba(90,40,20,0.11)' },
  { name: 'Kadayawan', accent: '#6a3a0e', place: 'Davao', bands: ['#ff9800', '#7cb342', '#8d6e63', '#fdd835'], flags: ['#ff9800', '#7cb342', '#fdd835', '#f06292', '#8d6e63'], tint: 'rgba(255,160,60,0.09)' },
];

export const festival = (level) => FESTIVALS[(Math.max(1, level) - 1) % FESTIVALS.length];
