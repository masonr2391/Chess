importScripts('https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js');

const PIECE_VALS = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

// Basic opening book for "Book Move" detection
const OPENING_BOOK = ["e4", "e5", "d4", "d5", "Nf3", "Nc6", "c4", "c5"];

function evaluate(g) {
    let total = 0;
    g.board().forEach(row => row.forEach(p => {
        if (p) total += (p.color === 'w' ? 1 : -1) * PIECE_VALS[p.type];
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
    const { fenBefore, fenAfter, move, depth } = e.data;
    const gBefore = new Chess(fenBefore);
    const gAfter = new Chess(fenAfter);
    
    // 1. Calculate Evaluation for before and after move
    const evalBefore = evaluate(gBefore);
    const evalAfter = evaluate(gAfter);
    const diff = gBefore.turn() === 'w' ? (evalAfter - evalBefore) : (evalBefore - evalAfter);

    // 2. Find the Engine's Best Move for comparison
    const allMoves = gBefore.moves();
    let engineBestMove = allMoves[0];
    let engineBestScore = gBefore.turn() === 'w' ? -Infinity : Infinity;

    for (let m of allMoves) {
        gBefore.move(m);
        let val = minimax(gBefore, 1, -Infinity, Infinity, gBefore.turn() === 'w');
        gBefore.undo();
        if ((gBefore.turn() === 'w' && val > engineBestScore) || (gBefore.turn() === 'b' && val < engineBestScore)) {
            engineBestScore = val; engineBestMove = m;
        }
    }

    // 3. APPLY YOUR DEFINITIONS
    let rating = 'good';

    if (OPENING_BOOK.includes(move.san)) rating = 'book';
    else if (move.captured && diff >= -10) rating = 'brilliant'; // Sacrifice that works
    else if (move.san === engineBestMove) rating = 'bestmove';
    else if (diff >= -30) rating = 'excellent';
    else if (diff < -300) rating = 'blunder'; // ~3 points drop
    else if (diff < -200) rating = 'mistake';  // ~2 points drop
    else if (diff < -80) rating = 'inaccuracy';
    
    // Check for MISS: Did user ignore a move that was 300 points better?
    const missDiff = gBefore.turn() === 'w' ? (engineBestScore - evalAfter) : (evalAfter - engineBestScore);
    if (missDiff > 300 && rating !== 'blunder') rating = 'miss';

    postMessage({ type: 'feedback', square: move.to, rating: rating });

    // 4. Calculate AI Counter-Move
    const moves = gAfter.moves();
    let bestMove = moves[0];
    let bestVal = gAfter.turn() === 'w' ? -Infinity : Infinity;
    for (let m of moves) {
        gAfter.move(m);
        let val = minimax(gAfter, depth - 1, -Infinity, Infinity, gAfter.turn() === 'w');
        gAfter.undo();
        if ((gAfter.turn() === 'w' && val > bestVal) || (gAfter.turn() === 'b' && val < bestVal)) {
            bestVal = val; bestMove = m;
        }
    }
    postMessage({ type: 'move', move: bestMove });
};
