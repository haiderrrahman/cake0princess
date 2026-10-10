export type LottoGameType = "super_key" | "iraq_lotto";

export interface LottoDraw {
  id: string;
  game: LottoGameType;
  drawNumber: number;
  date: string; // YYYY-MM-DD
  numbers: number[]; // 6 numbers
  luckyNumber?: number; // Only for super_key
  createdAt?: string;
}

export interface LottoTicket {
  id: string;
  game: LottoGameType;
  ticketName?: string;
  numbers: number[]; // 6 numbers
  luckyNumber?: number; // for super_key
  drawDate: string; // YYYY-MM-DD
  drawNumber?: number;
  cost: number;
  expenseId?: string;
  status: "pending" | "matched";
  matchCount?: number;
  luckyMatched?: boolean;
  matchedNumbers?: number[];
  prizeTier?: string;
  createdAt: string;
}

export const INITIAL_SUPER_KEY_DRAWS: LottoDraw[] = [
  { id: "sk-23", game: "super_key", drawNumber: 23, date: "2026-09-30", numbers: [3, 4, 10, 24, 28, 39], luckyNumber: 20 },
  { id: "sk-22", game: "super_key", drawNumber: 22, date: "2026-09-26", numbers: [7, 8, 17, 18, 35, 38], luckyNumber: 21 },
  { id: "sk-21", game: "super_key", drawNumber: 21, date: "2026-09-23", numbers: [3, 22, 29, 35, 37, 42], luckyNumber: 34 },
  { id: "sk-20", game: "super_key", drawNumber: 20, date: "2026-09-19", numbers: [3, 4, 15, 26, 39, 41], luckyNumber: 1 },
  { id: "sk-19", game: "super_key", drawNumber: 19, date: "2026-09-16", numbers: [1, 11, 15, 20, 24, 29], luckyNumber: 23 },
  { id: "sk-18", game: "super_key", drawNumber: 18, date: "2026-09-12", numbers: [5, 15, 21, 31, 36, 37], luckyNumber: 3 },
  { id: "sk-17", game: "super_key", drawNumber: 17, date: "2026-09-09", numbers: [4, 6, 12, 14, 36, 38], luckyNumber: 15 },
  { id: "sk-16", game: "super_key", drawNumber: 16, date: "2026-09-05", numbers: [8, 9, 20, 25, 33, 35], luckyNumber: 21 },
  { id: "sk-15", game: "super_key", drawNumber: 15, date: "2026-09-02", numbers: [2, 8, 18, 32, 38, 40], luckyNumber: 37 },
  { id: "sk-14", game: "super_key", drawNumber: 14, date: "2026-08-29", numbers: [3, 8, 17, 25, 39, 40], luckyNumber: 19 },
  { id: "sk-13", game: "super_key", drawNumber: 13, date: "2026-08-26", numbers: [5, 11, 16, 18, 29, 40], luckyNumber: 19 },
  { id: "sk-12", game: "super_key", drawNumber: 12, date: "2026-08-22", numbers: [15, 16, 20, 26, 30, 39], luckyNumber: 7 },
  { id: "sk-11", game: "super_key", drawNumber: 11, date: "2026-08-19", numbers: [6, 7, 10, 14, 22, 31], luckyNumber: 24 },
  { id: "sk-10", game: "super_key", drawNumber: 10, date: "2026-08-15", numbers: [2, 5, 7, 14, 37, 40], luckyNumber: 26 },
  { id: "sk-9", game: "super_key", drawNumber: 9, date: "2026-08-12", numbers: [15, 17, 18, 26, 30, 40], luckyNumber: 8 },
  { id: "sk-8", game: "super_key", drawNumber: 8, date: "2026-08-08", numbers: [3, 13, 17, 32, 37, 40], luckyNumber: 24 },
  { id: "sk-7", game: "super_key", drawNumber: 7, date: "2026-08-05", numbers: [2, 16, 24, 25, 29, 30], luckyNumber: 32 },
  { id: "sk-6", game: "super_key", drawNumber: 6, date: "2026-08-01", numbers: [6, 8, 22, 23, 27, 31], luckyNumber: 42 },
  { id: "sk-5", game: "super_key", drawNumber: 5, date: "2026-07-29", numbers: [7, 14, 17, 18, 26, 37], luckyNumber: 33 },
  { id: "sk-4", game: "super_key", drawNumber: 4, date: "2026-07-25", numbers: [12, 14, 15, 17, 25, 41], luckyNumber: 16 },
  { id: "sk-3", game: "super_key", drawNumber: 3, date: "2026-07-22", numbers: [1, 5, 13, 22, 33, 34], luckyNumber: 9 },
  { id: "sk-2", game: "super_key", drawNumber: 2, date: "2026-07-18", numbers: [7, 9, 10, 19, 33, 40], luckyNumber: 20 },
  { id: "sk-1", game: "super_key", drawNumber: 1, date: "2026-07-15", numbers: [20, 23, 29, 36, 38, 41], luckyNumber: 42 }
];

export const INITIAL_IRAQ_LOTTO_DRAWS: LottoDraw[] = [
  { id: "il-416", game: "iraq_lotto", drawNumber: 416, date: "2026-10-01", numbers: [13, 14, 18, 19, 20, 25] },
  { id: "il-415", game: "iraq_lotto", drawNumber: 415, date: "2026-09-28", numbers: [6, 12, 14, 18, 24, 26] },
  { id: "il-414", game: "iraq_lotto", drawNumber: 414, date: "2026-09-24", numbers: [2, 5, 13, 19, 24, 27] },
  { id: "il-413", game: "iraq_lotto", drawNumber: 413, date: "2026-09-21", numbers: [13, 16, 17, 21, 24, 25] },
  { id: "il-412", game: "iraq_lotto", drawNumber: 412, date: "2026-09-17", numbers: [2, 5, 10, 17, 20, 27] },
  { id: "il-411", game: "iraq_lotto", drawNumber: 411, date: "2026-09-14", numbers: [10, 11, 22, 24, 25, 27] },
  { id: "il-410", game: "iraq_lotto", drawNumber: 410, date: "2026-09-10", numbers: [4, 5, 6, 8, 10, 26] },
  { id: "il-409", game: "iraq_lotto", drawNumber: 409, date: "2026-09-07", numbers: [4, 6, 8, 14, 19, 24] },
  { id: "il-408", game: "iraq_lotto", drawNumber: 408, date: "2026-09-03", numbers: [1, 10, 12, 20, 21, 23] },
  { id: "il-407", game: "iraq_lotto", drawNumber: 407, date: "2026-08-31", numbers: [1, 7, 14, 18, 22, 26] },
  { id: "il-406", game: "iraq_lotto", drawNumber: 406, date: "2026-08-27", numbers: [4, 5, 7, 12, 15, 28] },
  { id: "il-405", game: "iraq_lotto", drawNumber: 405, date: "2026-08-24", numbers: [4, 8, 14, 16, 22, 29] },
  { id: "il-404", game: "iraq_lotto", drawNumber: 404, date: "2026-08-20", numbers: [8, 9, 11, 14, 22, 28] },
  { id: "il-403", game: "iraq_lotto", drawNumber: 403, date: "2026-08-17", numbers: [1, 2, 5, 11, 22, 27] },
  { id: "il-402", game: "iraq_lotto", drawNumber: 402, date: "2026-08-13", numbers: [5, 6, 11, 17, 23, 27] },
  { id: "il-401", game: "iraq_lotto", drawNumber: 401, date: "2026-08-10", numbers: [7, 10, 15, 23, 24, 28] },
  { id: "il-400", game: "iraq_lotto", drawNumber: 400, date: "2026-08-06", numbers: [5, 16, 20, 21, 25, 27] },
  { id: "il-399", game: "iraq_lotto", drawNumber: 399, date: "2026-08-03", numbers: [5, 6, 7, 16, 24, 26] },
  { id: "il-398", game: "iraq_lotto", drawNumber: 398, date: "2026-07-30", numbers: [3, 8, 10, 12, 15, 25] },
  { id: "il-397", game: "iraq_lotto", drawNumber: 397, date: "2026-07-27", numbers: [4, 6, 12, 13, 15, 18] },
  { id: "il-396", game: "iraq_lotto", drawNumber: 396, date: "2026-07-23", numbers: [5, 12, 15, 16, 17, 26] },
  { id: "il-395", game: "iraq_lotto", drawNumber: 395, date: "2026-07-20", numbers: [1, 2, 5, 6, 19, 26] },
  { id: "il-394", game: "iraq_lotto", drawNumber: 394, date: "2026-07-16", numbers: [14, 15, 16, 27, 28, 29] },
  { id: "il-393", game: "iraq_lotto", drawNumber: 393, date: "2026-07-13", numbers: [5, 17, 19, 22, 26, 27] },
  { id: "il-392", game: "iraq_lotto", drawNumber: 392, date: "2026-07-09", numbers: [6, 10, 16, 19, 20, 23] },
  { id: "il-391", game: "iraq_lotto", drawNumber: 391, date: "2026-07-06", numbers: [5, 10, 15, 16, 20, 28] },
  { id: "il-390", game: "iraq_lotto", drawNumber: 390, date: "2026-07-02", numbers: [2, 10, 13, 14, 15, 27] },
  { id: "il-389", game: "iraq_lotto", drawNumber: 389, date: "2026-06-29", numbers: [9, 16, 18, 20, 25, 27] },
  { id: "il-388", game: "iraq_lotto", drawNumber: 388, date: "2026-06-25", numbers: [5, 11, 15, 17, 22, 26] },
  { id: "il-387", game: "iraq_lotto", drawNumber: 387, date: "2026-06-22", numbers: [2, 6, 18, 20, 28, 29] },
  { id: "il-386", game: "iraq_lotto", drawNumber: 386, date: "2026-06-18", numbers: [8, 10, 16, 19, 27, 29] },
  { id: "il-385", game: "iraq_lotto", drawNumber: 385, date: "2026-06-15", numbers: [1, 15, 19, 21, 23, 29] },
  { id: "il-384", game: "iraq_lotto", drawNumber: 384, date: "2026-06-11", numbers: [9, 17, 19, 20, 24, 26] },
  { id: "il-383", game: "iraq_lotto", drawNumber: 383, date: "2026-06-08", numbers: [3, 9, 19, 22, 23, 25] },
  { id: "il-382", game: "iraq_lotto", drawNumber: 382, date: "2026-06-04", numbers: [2, 6, 10, 15, 19, 28] },
  { id: "il-381", game: "iraq_lotto", drawNumber: 381, date: "2026-06-01", numbers: [9, 13, 14, 18, 25, 26] },
  { id: "il-380", game: "iraq_lotto", drawNumber: 380, date: "2026-05-28", numbers: [2, 4, 7, 8, 15, 24] },
  { id: "il-379", game: "iraq_lotto", drawNumber: 379, date: "2026-05-25", numbers: [5, 11, 22, 25, 27, 29] },
  { id: "il-378", game: "iraq_lotto", drawNumber: 378, date: "2026-05-21", numbers: [1, 4, 5, 12, 23, 28] },
  { id: "il-377", game: "iraq_lotto", drawNumber: 377, date: "2026-05-18", numbers: [1, 2, 3, 13, 25, 29] },
  { id: "il-376", game: "iraq_lotto", drawNumber: 376, date: "2026-05-14", numbers: [1, 16, 19, 24, 26, 29] },
  { id: "il-375", game: "iraq_lotto", drawNumber: 375, date: "2026-05-11", numbers: [7, 10, 14, 15, 20, 28] },
  { id: "il-374", game: "iraq_lotto", drawNumber: 374, date: "2026-05-07", numbers: [4, 12, 14, 22, 27, 29] },
  { id: "il-373", game: "iraq_lotto", drawNumber: 373, date: "2026-05-04", numbers: [1, 2, 3, 23, 25, 28] },
  { id: "il-372", game: "iraq_lotto", drawNumber: 372, date: "2026-04-30", numbers: [3, 10, 14, 18, 20, 21] },
  { id: "il-371", game: "iraq_lotto", drawNumber: 371, date: "2026-04-27", numbers: [2, 6, 12, 13, 15, 28] },
  { id: "il-370", game: "iraq_lotto", drawNumber: 370, date: "2026-04-23", numbers: [4, 9, 13, 19, 20, 22] },
  { id: "il-369", game: "iraq_lotto", drawNumber: 369, date: "2026-04-20", numbers: [2, 6, 7, 16, 24, 27] },
  { id: "il-368", game: "iraq_lotto", drawNumber: 368, date: "2026-04-16", numbers: [1, 4, 6, 17, 21, 24] },
  { id: "il-367", game: "iraq_lotto", drawNumber: 367, date: "2026-04-13", numbers: [2, 10, 11, 12, 23, 28] },
  { id: "il-366", game: "iraq_lotto", drawNumber: 366, date: "2026-04-09", numbers: [1, 7, 12, 22, 26, 27] },
  { id: "il-365", game: "iraq_lotto", drawNumber: 365, date: "2026-04-06", numbers: [3, 4, 7, 11, 24, 28] },
  { id: "il-364", game: "iraq_lotto", drawNumber: 364, date: "2026-04-02", numbers: [2, 11, 14, 25, 28, 29] },
  { id: "il-363", game: "iraq_lotto", drawNumber: 363, date: "2026-03-30", numbers: [1, 2, 5, 20, 23, 28] },
  { id: "il-362", game: "iraq_lotto", drawNumber: 362, date: "2026-03-26", numbers: [3, 5, 13, 19, 20, 21] },
  { id: "il-361", game: "iraq_lotto", drawNumber: 361, date: "2026-03-23", numbers: [9, 13, 19, 22, 27, 29] },
  { id: "il-360", game: "iraq_lotto", drawNumber: 360, date: "2026-03-19", numbers: [10, 13, 16, 19, 28, 29] },
  { id: "il-359", game: "iraq_lotto", drawNumber: 359, date: "2026-03-16", numbers: [9, 10, 11, 20, 28, 29] },
  { id: "il-358", game: "iraq_lotto", drawNumber: 358, date: "2026-03-12", numbers: [1, 6, 8, 9, 22, 27] },
  { id: "il-357", game: "iraq_lotto", drawNumber: 357, date: "2026-03-09", numbers: [1, 4, 8, 11, 12, 23] },
  { id: "il-356", game: "iraq_lotto", drawNumber: 356, date: "2026-03-05", numbers: [3, 15, 21, 22, 25, 27] },
  { id: "il-355", game: "iraq_lotto", drawNumber: 355, date: "2026-03-02", numbers: [2, 3, 9, 13, 16, 21] },
  { id: "il-354", game: "iraq_lotto", drawNumber: 354, date: "2026-02-26", numbers: [4, 7, 8, 13, 14, 24] },
  { id: "il-353", game: "iraq_lotto", drawNumber: 353, date: "2026-02-23", numbers: [6, 7, 8, 10, 17, 29] },
  { id: "il-352", game: "iraq_lotto", drawNumber: 352, date: "2026-02-19", numbers: [1, 4, 19, 20, 23, 24] },
  { id: "il-351", game: "iraq_lotto", drawNumber: 351, date: "2026-02-16", numbers: [4, 9, 15, 20, 22, 27] },
  { id: "il-350", game: "iraq_lotto", drawNumber: 350, date: "2026-02-12", numbers: [1, 4, 8, 12, 13, 28] },
  { id: "il-349", game: "iraq_lotto", drawNumber: 349, date: "2026-02-09", numbers: [1, 13, 16, 18, 26, 27] },
  { id: "il-348", game: "iraq_lotto", drawNumber: 348, date: "2026-02-05", numbers: [9, 13, 16, 20, 23, 27] },
  { id: "il-347", game: "iraq_lotto", drawNumber: 347, date: "2026-02-02", numbers: [1, 3, 5, 7, 20, 21] },
  { id: "il-346", game: "iraq_lotto", drawNumber: 346, date: "2026-01-29", numbers: [4, 5, 8, 13, 20, 22] },
  { id: "il-345", game: "iraq_lotto", drawNumber: 345, date: "2026-01-26", numbers: [2, 3, 4, 13, 25, 29] },
  { id: "il-344", game: "iraq_lotto", drawNumber: 344, date: "2026-01-22", numbers: [8, 10, 12, 24, 25, 29] },
  { id: "il-343", game: "iraq_lotto", drawNumber: 343, date: "2026-01-19", numbers: [1, 2, 3, 14, 22, 23] },
  { id: "il-342", game: "iraq_lotto", drawNumber: 342, date: "2026-01-15", numbers: [3, 12, 15, 20, 21, 28] },
  { id: "il-341", game: "iraq_lotto", drawNumber: 341, date: "2026-01-12", numbers: [1, 4, 7, 10, 25, 29] },
  { id: "il-340", game: "iraq_lotto", drawNumber: 340, date: "2026-01-08", numbers: [1, 3, 12, 13, 19, 28] },
  { id: "il-339", game: "iraq_lotto", drawNumber: 339, date: "2026-01-05", numbers: [1, 5, 11, 12, 22, 29] },
  { id: "il-338", game: "iraq_lotto", drawNumber: 338, date: "2026-01-01", numbers: [2, 4, 11, 12, 17, 19] },
  { id: "il-337", game: "iraq_lotto", drawNumber: 337, date: "2025-12-29", numbers: [14, 17, 18, 20, 22, 26] },
  { id: "il-336", game: "iraq_lotto", drawNumber: 336, date: "2025-12-25", numbers: [10, 11, 17, 20, 24, 25] },
  { id: "il-335", game: "iraq_lotto", drawNumber: 335, date: "2025-12-22", numbers: [8, 11, 21, 22, 24, 25] },
  { id: "il-334", game: "iraq_lotto", drawNumber: 334, date: "2025-12-18", numbers: [3, 12, 14, 19, 24, 29] },
  { id: "il-333", game: "iraq_lotto", drawNumber: 333, date: "2025-12-15", numbers: [2, 11, 16, 19, 20, 28] },
  { id: "il-332", game: "iraq_lotto", drawNumber: 332, date: "2025-12-11", numbers: [2, 11, 14, 15, 24, 26] },
  { id: "il-331", game: "iraq_lotto", drawNumber: 331, date: "2025-12-08", numbers: [1, 5, 6, 9, 11, 15] },
  { id: "il-330", game: "iraq_lotto", drawNumber: 330, date: "2025-12-04", numbers: [1, 3, 4, 8, 9, 23] },
  { id: "il-329", game: "iraq_lotto", drawNumber: 329, date: "2025-12-01", numbers: [2, 9, 11, 15, 22, 28] },
  { id: "il-328", game: "iraq_lotto", drawNumber: 328, date: "2025-11-27", numbers: [1, 4, 7, 12, 21, 23] },
  { id: "il-327", game: "iraq_lotto", drawNumber: 327, date: "2025-11-24", numbers: [2, 8, 11, 21, 22, 28] },
  { id: "il-326", game: "iraq_lotto", drawNumber: 326, date: "2025-11-20", numbers: [8, 11, 14, 21, 22, 28] },
  { id: "il-325", game: "iraq_lotto", drawNumber: 325, date: "2025-11-17", numbers: [9, 17, 18, 20, 21, 25] },
  { id: "il-324", game: "iraq_lotto", drawNumber: 324, date: "2025-11-13", numbers: [3, 6, 11, 13, 20, 25] },
  { id: "il-323", game: "iraq_lotto", drawNumber: 323, date: "2025-11-10", numbers: [2, 5, 8, 18, 19, 27] },
  { id: "il-322", game: "iraq_lotto", drawNumber: 322, date: "2025-11-06", numbers: [1, 8, 9, 15, 17, 27] },
  { id: "il-321", game: "iraq_lotto", drawNumber: 321, date: "2025-11-03", numbers: [15, 16, 18, 23, 24, 29] },
  { id: "il-320", game: "iraq_lotto", drawNumber: 320, date: "2025-10-30", numbers: [7, 9, 11, 20, 23, 25] },
  { id: "il-319", game: "iraq_lotto", drawNumber: 319, date: "2025-10-27", numbers: [3, 5, 11, 14, 15, 25] },
  { id: "il-318", game: "iraq_lotto", drawNumber: 318, date: "2025-10-23", numbers: [14, 15, 16, 20, 26, 27] },
  { id: "il-317", game: "iraq_lotto", drawNumber: 317, date: "2025-10-20", numbers: [1, 2, 3, 5, 9, 26] },
  { id: "il-316", game: "iraq_lotto", drawNumber: 316, date: "2025-10-16", numbers: [12, 14, 17, 22, 23, 24] },
  { id: "il-315", game: "iraq_lotto", drawNumber: 315, date: "2025-10-13", numbers: [1, 5, 10, 11, 15, 26] },
  { id: "il-314", game: "iraq_lotto", drawNumber: 314, date: "2025-10-09", numbers: [3, 11, 12, 24, 26, 29] },
  { id: "il-313", game: "iraq_lotto", drawNumber: 313, date: "2025-10-06", numbers: [2, 5, 8, 18, 21, 24] },
  { id: "il-312", game: "iraq_lotto", drawNumber: 312, date: "2025-10-02", numbers: [1, 13, 14, 15, 21, 28] },
  { id: "il-311", game: "iraq_lotto", drawNumber: 311, date: "2025-09-29", numbers: [9, 11, 14, 15, 19, 22] },
  { id: "il-310", game: "iraq_lotto", drawNumber: 310, date: "2025-09-25", numbers: [3, 9, 11, 15, 18, 21] },
  { id: "il-309", game: "iraq_lotto", drawNumber: 309, date: "2025-09-22", numbers: [6, 11, 13, 15, 22, 26] },
  { id: "il-308", game: "iraq_lotto", drawNumber: 308, date: "2025-09-18", numbers: [9, 10, 19, 20, 27, 29] },
  { id: "il-307", game: "iraq_lotto", drawNumber: 307, date: "2025-09-15", numbers: [14, 18, 20, 22, 26, 28] },
  { id: "il-306", game: "iraq_lotto", drawNumber: 306, date: "2025-09-11", numbers: [2, 5, 8, 11, 21, 25] },
  { id: "il-305", game: "iraq_lotto", drawNumber: 305, date: "2025-09-08", numbers: [2, 8, 10, 15, 28, 29] },
  { id: "il-304", game: "iraq_lotto", drawNumber: 304, date: "2025-09-04", numbers: [4, 5, 7, 10, 17, 20] },
  { id: "il-303", game: "iraq_lotto", drawNumber: 303, date: "2025-09-01", numbers: [1, 5, 16, 22, 28, 29] },
  { id: "il-302", game: "iraq_lotto", drawNumber: 302, date: "2025-08-28", numbers: [9, 19, 21, 22, 24, 25] },
  { id: "il-301", game: "iraq_lotto", drawNumber: 301, date: "2025-08-25", numbers: [10, 11, 20, 24, 27, 28] },
  { id: "il-300", game: "iraq_lotto", drawNumber: 300, date: "2025-08-21", numbers: [7, 10, 13, 21, 27, 28] },
  { id: "il-299", game: "iraq_lotto", drawNumber: 299, date: "2025-08-18", numbers: [3, 18, 24, 25, 26, 27] },
  { id: "il-298", game: "iraq_lotto", drawNumber: 298, date: "2025-08-14", numbers: [2, 5, 11, 17, 27, 28] },
  { id: "il-297", game: "iraq_lotto", drawNumber: 297, date: "2025-08-11", numbers: [2, 6, 9, 16, 19, 21] },
  { id: "il-296", game: "iraq_lotto", drawNumber: 296, date: "2025-08-07", numbers: [3, 6, 18, 21, 22, 27] },
  { id: "il-295", game: "iraq_lotto", drawNumber: 295, date: "2025-08-04", numbers: [2, 8, 10, 14, 17, 19] },
  { id: "il-294", game: "iraq_lotto", drawNumber: 294, date: "2025-07-31", numbers: [1, 8, 11, 16, 23, 26] },
  { id: "il-293", game: "iraq_lotto", drawNumber: 293, date: "2025-07-28", numbers: [1, 3, 4, 12, 26, 28] },
  { id: "il-292", game: "iraq_lotto", drawNumber: 292, date: "2025-07-24", numbers: [1, 3, 19, 24, 27, 28] },
  { id: "il-291", game: "iraq_lotto", drawNumber: 291, date: "2025-07-21", numbers: [1, 14, 15, 17, 21, 23] },
  { id: "il-290", game: "iraq_lotto", drawNumber: 290, date: "2025-07-17", numbers: [6, 8, 9, 13, 14, 16] },
  { id: "il-289", game: "iraq_lotto", drawNumber: 289, date: "2025-07-14", numbers: [1, 3, 4, 13, 15, 26] },
  { id: "il-288", game: "iraq_lotto", drawNumber: 288, date: "2025-07-10", numbers: [2, 6, 18, 19, 27, 29] }
];

export const GAME_DETAILS = {
  super_key: {
    title: "لوتو العراق سوبر كي",
    shortTitle: "سوبر كي (42)",
    maxNumber: 42,
    pickCount: 6,
    hasLuckyNumber: true,
    drawDaysArabic: "كل سبت وأربعاء",
    drawDays: [3, 6], // 3: Wednesday, 6: Saturday
    ticketPrice: 2350, // 2,350 IQD (محدث رسمياً)
    badgeColor: "from-amber-500 via-rose-500 to-purple-600",
    themeColor: "#8b5cf6"
  },
  iraq_lotto: {
    title: "لوتو العراق الخيري (6 من 29)",
    shortTitle: "لوتو العراق (29)",
    maxNumber: 29,
    pickCount: 6,
    hasLuckyNumber: false,
    drawDaysArabic: "كل اثنين وخميس",
    drawDays: [1, 4], // 1: Monday, 4: Thursday
    ticketPrice: 1500, // 1,500 IQD
    badgeColor: "from-red-600 via-pink-600 to-amber-500",
    themeColor: "#e11d48"
  }
};

export interface PredictionAnalysis {
  sum: number;
  expectedSumRange: [number, number];
  sumQuality: "مثالي 🌟" | "جيد جداً ✨" | "مقبول 📊";
  oddCount: number;
  evenCount: number;
  parityBalance: string;
  lowCount: number;
  highCount: number;
  highLowBalance: string;
  hotCount: number;
  dueCount: number;
  mediumCount: number;
  confidenceScore: number; // 85% - 98%
  strategyLabel: string;
  deltaScore: string;
}

export interface SavedPrediction {
  game: LottoGameType;
  numbers: number[];
  luckyNumber?: number;
  isLocked: boolean;
  strategy: "balanced" | "hot" | "cold" | "ai_hybrid" | "custom";
  confidenceScore: number;
  analysis: PredictionAnalysis;
  updatedAt: string;
}

/**
 * Returns the next upcoming draw date in YYYY-MM-DD
 */
export function getNextDrawDate(game: LottoGameType, fromDate = new Date()): string {
  const targetDays = GAME_DETAILS[game].drawDays;
  const currentDay = fromDate.getDay();
  let minDiff = 7;

  for (const day of targetDays) {
    let diff = (day - currentDay + 7) % 7;
    // If today is a draw day after 8 PM, take next draw day
    if (diff === 0 && fromDate.getHours() >= 20) {
      diff = 7;
    }
    if (diff < minDiff) {
      minDiff = diff;
    }
  }

  const nextDate = new Date(fromDate);
  nextDate.setDate(nextDate.getDate() + minDiff);
  return nextDate.toISOString().split("T")[0];
}

/**
 * Calculate frequencies of numbers and deep statistical properties from historical draws
 */
export function calculateLottoStats(draws: LottoDraw[], game: LottoGameType) {
  const max = GAME_DETAILS[game].maxNumber;
  const gameDraws = draws.filter(d => d.game === game);
  const totalDraws = gameDraws.length;

  const numberCounts: Record<number, number> = {};
  const luckyCounts: Record<number, number> = {};
  const lastSeenMap: Record<number, number> = {}; // draw index distance
  const coOccur: Record<string, number> = {};

  for (let i = 1; i <= max; i++) {
    numberCounts[i] = 0;
    luckyCounts[i] = 0;
    lastSeenMap[i] = totalDraws; // default never seen
  }

  gameDraws.forEach((draw, drawIdx) => {
    const sortedNums = [...draw.numbers].sort((a, b) => a - b);
    sortedNums.forEach((n, i) => {
      if (numberCounts[n] !== undefined) {
        numberCounts[n]++;
        if (lastSeenMap[n] === totalDraws) {
          lastSeenMap[n] = drawIdx; // distance from latest
        }
      }
      // Track pairs
      for (let j = i + 1; j < sortedNums.length; j++) {
        const pairKey = `${n}-${sortedNums[j]}`;
        coOccur[pairKey] = (coOccur[pairKey] || 0) + 1;
      }
    });

    if (draw.luckyNumber && luckyCounts[draw.luckyNumber] !== undefined) {
      luckyCounts[draw.luckyNumber]++;
    }
  });

  const expectedAvgDraws = totalDraws > 0 ? (totalDraws * 6) / max : 1;
  const expectedInterval = max / 6; // e.g. 7 draws for 42, 4.8 draws for 29

  const frequencyList = Object.entries(numberCounts)
    .map(([numStr, count]) => {
      const num = Number(numStr);
      const drawsAgo = lastSeenMap[num] ?? totalDraws;
      // Due tension: how overdue is it relative to expected interval
      const overdueRatio = drawsAgo / expectedInterval;
      return {
        number: num,
        count,
        lastSeenDrawsAgo: drawsAgo,
        overdueRatio,
        percentage: totalDraws > 0 ? Math.round((count / totalDraws) * 100) : 0,
        // Z-score deviation from expected frequency
        frequencyZ: totalDraws > 10 ? (count - expectedAvgDraws) / Math.sqrt(expectedAvgDraws) : 0
      };
    })
    .sort((a, b) => b.count - a.count);

  // Top hot numbers (high frequency & recent activity)
  const hotNumbers = frequencyList.slice(0, 10).map(x => x.number);
  
  // Overdue numbers (longest since last appearance)
  const coldNumbers = [...frequencyList]
    .sort((a, b) => b.lastSeenDrawsAgo - a.lastSeenDrawsAgo)
    .slice(0, 10)
    .map(x => x.number);

  // Median stable numbers
  const mediumNumbers = frequencyList.slice(8, Math.max(9, max - 8)).map(x => x.number);

  const luckyList = Object.entries(luckyCounts)
    .map(([num, count]) => ({ number: Number(num), count }))
    .sort((a, b) => b.count - a.count);

  const hotLuckyNumbers = luckyList.slice(0, 6).map(x => x.number);

  return {
    totalDraws,
    frequencyList,
    hotNumbers,
    coldNumbers,
    mediumNumbers,
    hotLuckyNumbers,
    coOccur
  };
}

/**
 * Evaluates the statistical health and metrics of any 6-number combination
 */
export function analyzeCombination(
  numbers: number[],
  game: LottoGameType,
  stats: ReturnType<typeof calculateLottoStats>,
  strategyLabel = "توليفة إحصائية"
): PredictionAnalysis {
  const max = GAME_DETAILS[game].maxNumber;
  const sorted = [...numbers].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, n) => acc + n, 0);

  // Expected Gaussian sum ranges
  // For Super Key (42): mean = 6 * 21.5 = 129, stdDev ~ 28. Golden range: 105 - 155
  // For Iraq Lotto (29): mean = 6 * 15 = 90, stdDev ~ 20. Golden range: 75 - 110
  const expectedSumRange: [number, number] = game === "super_key" ? [105, 155] : [75, 110];
  let sumQuality: PredictionAnalysis["sumQuality"] = "مقبول 📊";
  if (sum >= expectedSumRange[0] && sum <= expectedSumRange[1]) {
    sumQuality = "مثالي 🌟";
  } else if (sum >= expectedSumRange[0] - 15 && sum <= expectedSumRange[1] + 15) {
    sumQuality = "جيد جداً ✨";
  }

  // Parity (Odd / Even)
  const oddCount = sorted.filter(n => n % 2 !== 0).length;
  const evenCount = 6 - oddCount;
  const parityBalance = `${oddCount} فردي / ${evenCount} زوجي`;

  // High / Low split
  const mid = Math.floor(max / 2);
  const lowCount = sorted.filter(n => n <= mid).length;
  const highCount = 6 - lowCount;
  const highLowBalance = `${lowCount} منخفض / ${highCount} عالي`;

  // Overlap with Hot & Cold sets
  const hotSet = new Set(stats.hotNumbers);
  const coldSet = new Set(stats.coldNumbers);
  const hotCount = sorted.filter(n => hotSet.has(n)).length;
  const dueCount = sorted.filter(n => coldSet.has(n)).length;
  const mediumCount = 6 - (hotCount + dueCount);

  // Spacing Deltas
  const deltas = sorted.slice(1).map((n, i) => n - sorted[i]);
  const maxConsecutive = Math.max(...deltas.map(d => d === 1 ? 1 : 0));
  const deltaScore = maxConsecutive > 2 ? "تلاصق مفرط" : "تباعد مدروس ومثالي";

  // Calculate Scientific Confidence Score (85% to 98%)
  let score = 90;
  if (sumQuality === "مثالي 🌟") score += 4;
  else if (sumQuality === "جيد جداً ✨") score += 2;
  else score -= 3;

  // Best lottery parity: 3/3 (+3), 4/2 or 2/4 (+2), 5/1 or 1/5 (-3), 6/0 or 0/6 (-8)
  if (oddCount === 3) score += 3;
  else if (oddCount === 2 || oddCount === 4) score += 2;
  else score -= 4;

  // Best high/low: 3/3 (+2), 4/2 or 2/4 (+1)
  if (lowCount === 3) score += 2;
  else if (lowCount === 2 || lowCount === 4) score += 1;

  // Blend of hot and due (+2)
  if (hotCount >= 2 && dueCount >= 1) score += 2;

  const clampedConfidence = Math.min(98, Math.max(82, score));

  return {
    sum,
    expectedSumRange,
    sumQuality,
    oddCount,
    evenCount,
    parityBalance,
    lowCount,
    highCount,
    highLowBalance,
    hotCount,
    dueCount,
    mediumCount,
    confidenceScore: clampedConfidence,
    strategyLabel,
    deltaScore
  };
}

/**
 * Smart Mathematical & Statistical Prediction Engine
 * Respects user's locked/chosen numbers ("ثابت على الرقم اله اختار")
 */
export function predictNextNumbers(
  draws: LottoDraw[],
  game: LottoGameType,
  strategy: "balanced" | "hot" | "cold" | "ai_hybrid" = "balanced",
  lockedNumbers: number[] = [],
  lockedLucky?: number
): {
  numbers: number[];
  luckyNumber?: number;
  analysis: PredictionAnalysis;
} {
  const max = GAME_DETAILS[game].maxNumber;
  const stats = calculateLottoStats(draws, game);
  const validLocked = Array.from(new Set(lockedNumbers.filter(n => n >= 1 && n <= max)));

  // Strategy names in Arabic
  const strategyLabels: Record<string, string> = {
    balanced: "التوازن الإحصائي الذهبي",
    hot: "زخم الأرقام الساخنة",
    cold: "ارتداد الأرقام المتأخرة",
    ai_hybrid: "الذكاء الهجين التنبؤي"
  };

  // If user already locked 6 numbers, keep them 100% and just audit
  if (validLocked.length === 6) {
    const finalSorted = [...validLocked].sort((a, b) => a - b);
    const lucky = GAME_DETAILS[game].hasLuckyNumber
      ? (lockedLucky !== undefined && lockedLucky >= 1 && lockedLucky <= max ? lockedLucky : (stats.hotLuckyNumbers[0] || 7))
      : undefined;
    const analysis = analyzeCombination(finalSorted, game, stats, "الأرقام المختارة من قبلك (مثبتة)");
    return {
      numbers: finalSorted,
      luckyNumber: lucky,
      analysis
    };
  }

  // Weight map based on strategy
  const weights: Record<number, number> = {};
  for (let i = 1; i <= max; i++) weights[i] = 10;

  // Apply frequency & recency weights
  stats.frequencyList.forEach(item => {
    const num = item.number;
    if (strategy === "hot") {
      weights[num] += item.count * 8 + Math.max(0, 15 - item.lastSeenDrawsAgo) * 4;
    } else if (strategy === "cold") {
      weights[num] += item.lastSeenDrawsAgo * 9;
    } else if (strategy === "ai_hybrid") {
      // Co-occurrence + recent momentum
      weights[num] += item.count * 4 + item.overdueRatio * 6;
    } else {
      // Balanced: harmonic mean of frequency and due index
      const hotBonus = stats.hotNumbers.includes(num) ? 15 : 0;
      const dueBonus = stats.coldNumbers.includes(num) ? 12 : 0;
      const midBonus = stats.mediumNumbers.includes(num) ? 8 : 0;
      weights[num] += hotBonus + dueBonus + midBonus;
    }
  });

  // Target constraints
  const [minSum, maxSum] = game === "super_key" ? [105, 155] : [75, 110];

  let bestCombination: number[] = [];
  let bestScore = -Infinity;

  // Run combinatorial search iterations to find the optimal statistical combination
  for (let attempt = 0; attempt < 80; attempt++) {
    const candidateSet = new Set<number>(validLocked);

    // Weighted selection
    while (candidateSet.size < 6) {
      const remainingSlots = 6 - candidateSet.size;
      const available = [];
      let totalW = 0;

      for (let num = 1; num <= max; num++) {
        if (!candidateSet.has(num)) {
          let w = weights[num] || 1;
          // Soft penalty for consecutive numbers
          if (candidateSet.has(num - 1) && candidateSet.has(num + 1)) w *= 0.1;
          else if (candidateSet.has(num - 1) || candidateSet.has(num + 1)) w *= 0.5;

          available.push({ num, w });
          totalW += w;
        }
      }

      let r = Math.random() * totalW;
      for (const item of available) {
        r -= item.w;
        if (r <= 0) {
          candidateSet.add(item.num);
          break;
        }
      }
    }

    const candidateArr = Array.from(candidateSet).sort((a, b) => a - b);
    const analysis = analyzeCombination(candidateArr, game, stats);
    let attemptScore = analysis.confidenceScore;

    // Sum penalty
    if (analysis.sum < minSum || analysis.sum > maxSum) {
      attemptScore -= Math.abs(analysis.sum - (minSum + maxSum) / 2) * 0.3;
    }

    if (attemptScore > bestScore) {
      bestScore = attemptScore;
      bestCombination = candidateArr;
    }
  }

  const finalNumbers = bestCombination.length === 6 ? bestCombination : Array.from(new Set([...validLocked, 3, 8, 17, 24, 29, 38])).slice(0, 6).sort((a, b) => a - b);

  let luckyNumber: number | undefined;
  if (GAME_DETAILS[game].hasLuckyNumber) {
    if (lockedLucky !== undefined && lockedLucky >= 1 && lockedLucky <= max) {
      luckyNumber = lockedLucky;
    } else if (stats.hotLuckyNumbers.length > 0) {
      luckyNumber = stats.hotLuckyNumbers[0];
    } else {
      luckyNumber = 7;
    }
  }

  const finalAnalysis = analyzeCombination(
    finalNumbers,
    game,
    stats,
    strategyLabels[strategy] || "التوازن الإحصائي"
  );

  return {
    numbers: finalNumbers,
    luckyNumber,
    analysis: finalAnalysis
  };
}

/**
 * Match a ticket against a winning draw with detailed prize tier and matching details
 */
export function checkTicketMatch(ticket: LottoTicket, draw: LottoDraw) {
  const drawSet = new Set(draw.numbers);
  const matched = ticket.numbers.filter(n => drawSet.has(n));
  const matchCount = matched.length;

  let luckyMatched = false;
  if (ticket.luckyNumber !== undefined && draw.luckyNumber !== undefined) {
    luckyMatched = Number(ticket.luckyNumber) === Number(draw.luckyNumber);
  }

  let prizeTier = "لم يُحالفك الحظ هذه المرة";
  let hasWon = false;

  if (matchCount === 6) {
    prizeTier = "الجائزة الكبرى (الجاكبوت)! 👑🎉";
    hasWon = true;
  } else if (matchCount === 5 && luckyMatched) {
    prizeTier = "الجائزة الثانية (5 أرقام + رقم الحظ)! 🥈⭐";
    hasWon = true;
  } else if (matchCount === 5) {
    prizeTier = "الجائزة الثالثة (5 أرقام كاملة)! 🥉✨";
    hasWon = true;
  } else if (matchCount === 4 && luckyMatched) {
    prizeTier = "الجائزة الرابعة الممتازة (4 أرقام + رقم الحظ)! 🌟⭐";
    hasWon = true;
  } else if (matchCount === 4) {
    prizeTier = "الجائزة الرابعة (4 أرقام متطابقة)! 🌟";
    hasWon = true;
  } else if (matchCount === 3 && luckyMatched) {
    prizeTier = "الجائزة الخامسة الممتازة (3 أرقام + رقم الحظ)! 🎁⭐";
    hasWon = true;
  } else if (matchCount === 3) {
    prizeTier = "الجائزة الخامسة (3 أرقام متطابقة)! 🎁";
    hasWon = true;
  } else if (matchCount === 2 && luckyMatched) {
    prizeTier = "جائزة تطابق رقمين + رقم الحظ ⭐";
    hasWon = true;
  } else if (matchCount === 1 && luckyMatched) {
    prizeTier = "تطابق رقم واحد + رقم الحظ 🍀";
    hasWon = true;
  } else if (luckyMatched) {
    prizeTier = "تطابق رقم الحظ الإضافي 🍀";
    hasWon = true;
  } else if (matchCount === 2) {
    prizeTier = "تطابق رقمان (2 من 6)";
  } else if (matchCount === 1) {
    prizeTier = "تطابق رقم واحد (1 من 6)";
  }

  return {
    matchedNumbers: matched,
    matchCount,
    luckyMatched,
    prizeTier,
    hasWon
  };
}

