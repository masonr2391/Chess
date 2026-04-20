importScripts('https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js');

const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

// Piece-Square Tables: Encourages center control and king safety
const PST = {
    p: [ [0,0,0,0,0,0,0,0],[50,50,50,50,50,50,50,50],[10,10,20,30,30,20,10,10],[5,5,10,25,25,10,5,5],[0,0,0,20,20,0,0,0],[5,-5,-10,0,0,-10,-5,5],[5,10,10,-20,-20,10,10,5],[0,0,0,0,0,0,0,0] ],
    n: [ [-50,-40,-30,-30,-30,-30,-40,-50],[-40,-20,0,0,0,0,-20,-40],[-30,0,10,15,15,10,0,-30],[-30,5,15,20,20,15,5,-30],[-30,0,15,20,20,15,0,-30],[-30,5,10,15,15,10,5,-30],[-40,-20,0,5,5,0,-20,-40],[-50,-40,-30,-30,-30,-30,-40,-50] ],
    b: [ [-20,-10,-10,-10,-10,-10,-10,-20],[-10,0,0,0,0,0,0,-10],[-10,0,5,10,10,5,0,-10],[-10,5,5,10,10,5,5,-10],[-10,0,10,10,10,10,0,-10],[-10,10,10,10,10,10,10,-10],[-10,5,0,0,0,0,5,-10],[-20,-10,-10,-10,-10,-10,-10,-20] ]
};

function evaluateBoard(game) {
    let total = 0;
    const board = game.board();
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const piece = board[i][j];
            if (piece) {
                let val = PIECE_VALUES[piece.type];
                if (PST[piece.type]) {
                    val += (piece.color === 'w' ? PST[piece.type][i][j] : PST[piece.type][7 - i][j]);
                }
                total += (piece.color === 'w' ? 1 : -1) * val;
            }
        }
    }
    return total;
}

// Move Ordering: Checks captures and checks first
function orderMoves(game, moves) {
    return moves.sort((a, b) => {
        let scoreA = 0; let scoreB = 0;
        if (a.includes('x')) scoreA += 10;
        if (b.includes('x')) scoreB += 10;
        if (a.includes('+')) scoreA += 5;
        if (b.includes('+')) scoreB += 5;
        return scoreB - scoreA;
    });
}

function quiescenceSearch(game, alpha, beta, isMax) {
    let standPat = evaluateBoard(game);
    if (isMax) {
        if (standPat >= beta) return beta;
        alpha = Math.max(alpha, standPat);
    } else {
        if (standPat <= alpha) return alpha;
        beta = Math.min(beta, standPat);
    }
    let captureMoves = orderMoves(game, game.moves().filter(m => m.includes('x')));
    for (let move of captureMoves) {
        game.move(move);
        let score = quiescenceSearch(game, alpha, beta, !isMax);
        game.undo();
        if (isMax) { alpha = Math.max(alpha, score); if (beta <= alpha) break; }
        else { beta = Math.min(beta, score); if (beta <= alpha) break; }
    }
    return isMax ? alpha : beta;
}

function minimax(game, depth, alpha, beta, isMax) {
    if (depth === 0) return quiescenceSearch(game, alpha, beta, isMax);
    let moves = orderMoves(game, game.moves());
    if (moves.length === 0) return evaluateBoard(game);
    
    let bestVal = isMax ? -Infinity : Infinity;
    for (let move of moves) {
        game.move(move);
        let val = minimax(game, depth - 1, alpha, beta, !isMax);
        game.undo();
        bestVal = isMax ? Math.max(bestVal, val) : Math.min(bestVal, val);
        if (isMax) alpha = Math.max(alpha, bestVal); else beta = Math.min(beta, bestVal);
        if (beta <= alpha) break;
    }
    return bestVal;
}

onmessage = function(e) {
    const { type, fen, move, depth } = e.data;
    const game = new Chess(fen);
    
    // Evaluation BEFORE the user move
    const prevGame = new Chess(fen);
    prevGame.undo();
    const evalBefore = evaluateBoard(prevGame);
    
    // Find AI's favorite move for comparison
    let bestChoices = prevGame.moves();
    let topAiMove = bestChoices[0];
    let topAiScore = prevGame.turn() === 'w' ? -Infinity : Infinity;
    
    for (let m of bestChoices) {
        prevGame.move(m);
        let v = minimax(prevGame, 1, -Infinity, Infinity, prevGame.turn() === 'w');
        prevGame.undo();
        if ((prevGame.turn() === 'w' && v > topAiScore) || (prevGame.turn() === 'b' && v < topAiScore)) {
            topAiScore = v; topAiMove = m;
        }
    }

    // 1. Analyze User Move
    const evalAfter = evaluateBoard(game);
    let rating = 'good';
    const diff = game.turn() === 'b' ? (evalAfter - evalBefore) : (evalBefore - evalAfter);

    if (move.captured && diff >= -50) rating = 'brilliant';
    else if (move.san === topAiMove) rating = 'bestmove';
    else if (diff < -200) rating = 'blunder';
    else if (diff < -100) rating = 'mistake';

    postMessage({ type: 'feedback', square: move.to, rating: rating });

    // 2. Calculate AI Counter-move
    let moves = orderMoves(game, game.moves());
    let bestMove = moves[0];
    let bestValue = game.turn() === 'w' ? -Infinity : Infinity;

    for (let m of moves) {
        game.move(m);
        let val = minimax(game, depth - 1, -Infinity, Infinity, game.turn() === 'w');
        game.undo();
        if ((game.turn() === 'w' && val > bestValue) || (game.turn() === 'b' && val < bestValue)) {
            bestValue = val; bestMove = m;
        }
    }
    postMessage({ type: 'move', move: bestMove });
};
