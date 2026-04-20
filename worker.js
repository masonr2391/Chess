// Background AI brain to prevent page freezing
importScripts('https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js');

const pieceValues = { p: 100, r: 500, n: 320, b: 330, q: 900, k: 20000 };

function evaluate(g) {
    let total = 0;
    g.board().forEach(row => row.forEach(p => {
        if (p) total += (p.color === 'w' ? 1 : -1) * pieceValues[p.type];
    }));
    return total;
}

function minimax(g, depth, alpha, beta, isMax) {
    if (depth === 0 || g.game_over()) return evaluate(g);
    const moves = g.moves();
    let best = isMax ? -Infinity : Infinity;
    for (let m of moves) {
        g.move(m);
        let val = minimax(g, depth - 1, alpha, beta, !isMax);
        g.undo();
        best = isMax ? Math.max(best, val) : Math.min(best, val);
        if (isMax) alpha = Math.max(alpha, best); else beta = Math.min(beta, best);
        if (beta <= alpha) break;
    }
    return best;
}

onmessage = function(e) {
    const tempGame = new Chess(e.data.fen);
    const moves = tempGame.moves();
    let bestMove = null;
    let bestValue = tempGame.turn() === 'w' ? -Infinity : Infinity;

    for (let m of moves) {
        tempGame.move(m);
        let val = minimax(tempGame, e.data.depth - 1, -Infinity, Infinity, tempGame.turn() === 'w');
        tempGame.undo();
        if ((tempGame.turn() === 'w' && val > bestValue) || (tempGame.turn() === 'b' && val < bestValue)) {
            bestValue = val;
            bestMove = m;
        }
    }
    postMessage({ move: bestMove });
};
