let score = 0;
export const fruitScores = {
  cherry: 1,
  strawberry: 3,
  grape: 6,
  orange: 10,
  persimmon: 15,
  apple: 21,
  pear: 28,
  peach: 36,
  pineapple: 45,
  melon: 55,
  watermelon: 66,
}

let bestScore = Number(localStorage.getItem('suikaBestScore') || 0);

const scoreHud = document.createElement('div');
scoreHud.style.position = 'fixed';
scoreHud.style.top = '18px';
scoreHud.style.left = '18px';
scoreHud.style.width = '170px';
scoreHud.style.height = '170px';
scoreHud.style.borderRadius = '50%';
scoreHud.style.zIndex = '99999';
scoreHud.style.pointerEvents = 'none';
scoreHud.style.display = 'flex';
scoreHud.style.flexDirection = 'column';
scoreHud.style.alignItems = 'center';
scoreHud.style.justifyContent = 'center';
scoreHud.style.fontFamily = `'Trebuchet MS', 'Arial Rounded MT Bold', sans-serif`;
scoreHud.style.color = '#145caa';
scoreHud.style.background = `
  radial-gradient(circle at 32% 28%,
    rgba(255,255,255,0.96) 0%,
    rgba(240,248,255,0.82) 10%,
    rgba(214,233,248,0.56) 24%,
    rgba(184,214,236,0.34) 54%,
    rgba(150,192,224,0.22) 78%,
    rgba(120,170,210,0.16) 100%)
`;
scoreHud.style.border = '3px solid rgba(255,255,255,0.55)';
scoreHud.style.boxShadow = `
  inset 0 10px 18px rgba(255,255,255,0.72),
  inset 0 -10px 18px rgba(90,140,185,0.18),
  0 4px 12px rgba(40,90,130,0.12)
`;

const bubbleHighlight1 = document.createElement('div');
bubbleHighlight1.style.position = 'absolute';
bubbleHighlight1.style.width = '34px';
bubbleHighlight1.style.height = '20px';
bubbleHighlight1.style.top = '26px';
bubbleHighlight1.style.left = '24px';
bubbleHighlight1.style.borderRadius = '50%';
bubbleHighlight1.style.background = 'rgba(255,255,255,0.78)';
bubbleHighlight1.style.transform = 'rotate(-28deg)';
bubbleHighlight1.style.filter = 'blur(1px)';

const bubbleHighlight2 = document.createElement('div');
bubbleHighlight2.style.position = 'absolute';
bubbleHighlight2.style.width = '24px';
bubbleHighlight2.style.height = '14px';
bubbleHighlight2.style.right = '24px';
bubbleHighlight2.style.bottom = '28px';
bubbleHighlight2.style.borderRadius = '50%';
bubbleHighlight2.style.background = 'rgba(255,255,255,0.62)';
bubbleHighlight2.style.transform = 'rotate(28deg)';
bubbleHighlight2.style.filter = 'blur(1px)';

const scoreTitle = document.createElement('div');
scoreTitle.textContent = 'Score';
scoreTitle.style.fontSize = '26px';
scoreTitle.style.fontWeight = '800';
scoreTitle.style.lineHeight = '1';
scoreTitle.style.marginBottom = '8px';
scoreTitle.style.textShadow = '0 2px 0 rgba(255,255,255,0.8), 0 0 4px rgba(0,0,0,0.18)';

const scoreValue = document.createElement('div');
scoreValue.textContent = `${score}`;
scoreValue.style.fontSize = '54px';
scoreValue.style.fontWeight = '900';
scoreValue.style.lineHeight = '1';
scoreValue.style.marginBottom = '10px';
scoreValue.style.textShadow = '0 2px 0 rgba(255,255,255,0.8), 0 0 6px rgba(0,0,0,0.18)';

const bestLabel = document.createElement('div');
bestLabel.textContent = 'BEST SCORE';
bestLabel.style.fontSize = '14px';
bestLabel.style.fontWeight = '800';
bestLabel.style.letterSpacing = '0.5px';
bestLabel.style.opacity = '0.72';
bestLabel.style.lineHeight = '1';

const bestValue = document.createElement('div');
bestValue.textContent = `${bestScore}`;
bestValue.style.fontSize = '18px';
bestValue.style.fontWeight = '900';
bestValue.style.marginTop = '4px';
bestValue.style.lineHeight = '1';
bestValue.style.textShadow = '0 1px 0 rgba(255,255,255,0.8)';

scoreHud.appendChild(bubbleHighlight1);
scoreHud.appendChild(bubbleHighlight2);
scoreHud.appendChild(scoreTitle);
scoreHud.appendChild(scoreValue);
scoreHud.appendChild(bestLabel);
scoreHud.appendChild(bestValue);
document.body.appendChild(scoreHud);

export function addScore(points) {
  score += points;
  scoreValue.textContent = `${score}`;

  if (score > bestScore) {
    bestScore = score;
    bestValue.textContent = `${bestScore}`;
    localStorage.setItem('suikaBestScore', String(bestScore));
  }
}
