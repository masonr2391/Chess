importScripts('https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js');

const PIECE_VALS = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

// Very basic book moves for detection
const BOOK = ["e4", "e5", "d4", "d5", "Nf3", "Nc6", "c4", "c5", "Nf6", "g6"];

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
    
    const evalBefore = evaluate(gBefore);
    const evalAfter = evaluate(gAfter);
    const diff = gBefore.turn() === 'w' ? (evalAfter - evalBefore) : (evalBefore - evalAfter);

    const allMoves = gBefore.moves();
    let scores = [];

    for (let m of allMoves) {
        gBefore.move(m);
        scores.push({ move: m, score: minimax(gBefore, 1, -Infinity, Infinity, gBefore.turn() === 'w') });
        gBefore.undo();
    }

    // Sort moves to see what the engine wanted
    scores.sort((a, b) => gBefore.turn() === 'w' ? b.score - a.score : a.score - b.score);
    
    const engineBestMove = scores[0].move;
    const engineBestScore = scores[0].score;
    const secondBestScore = scores.length > 1 ? scores[1].score : -99999;

    let rating = 'good';

    // 1. Book Move
    if (BOOK.includes(move.san)) rating = 'book';
    // 2. Brilliant: Sacrifice (piece value lost) but evaluation stays high
    else if (move.captured && diff >= -10) rating = 'brilliant';
    // 3. Great Move: The ONLY good move (next best is much worse)
    else if (move.san === engineBestMove && Math.abs(engineBestScore - secondBestScore) > 150) rating = 'greatmove';
    // 4. Best Move: Matches engine's top choice
    else if (move.san === engineBestMove) rating = 'bestmove';
    // 5. Excellent: Very close to best
    else if (Math.abs(engineBestScore - evalAfter) < 30) rating = 'excellent';
    // 6. Blunder: Evaluation drops by 300+
    else if (diff < -300) rating = 'blunder';
    // 7. Mistake: Evaluation drops by 200+
    else if (diff < -200) rating = 'mistake';
    // 8. Inaccuracy: Evaluation drops by 80+
    else if (diff < -80) rating = 'inaccuracy';
    
    // Miss Check: Did you ignore a move that was way better?
    const winOpportunity = gBefore.turn() === 'w' ? (engineBestScore - evalAfter) : (evalAfter - engineBestScore);
    if (winOpportunity > 300 && rating !== 'blunder') rating = 'miss';

    postMessage({ type: 'feedback', square: move.to, rating: rating });

    // AI Counter-Move
    const moves = gAfter.moves();
    let bMove = moves[0], bVal = gAfter.turn() === 'w' ? -Infinity : Infinity;
    for (let m of moves) {
        gAfter.move(m);
        let val = minimax(gAfter, depth - 1, -Infinity, Infinity, gAfter.turn() === 'w');
        gAfter.undo();
        if ((gAfter.turn() === 'w' && val > bVal) || (gAfter.turn() === 'b' && val < bVal)) {
            bVal = val; bMove = m;
        }
    }
    postMessage({ type: 'move', move: bMove });
};
