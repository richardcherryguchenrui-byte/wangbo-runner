// 单局评价:S/A/B/C/D,把「时长 + 操作 + 奖励」压缩成一眼能懂的等级。
// 只做纯计算,不依赖 Phaser,方便单元测试与战绩卡复用。

export type GradeLetter = 'S' | 'A' | 'B' | 'C' | 'D';

export interface RunGrade {
  letter: GradeLetter;
  label: string;
  color: string;
  score: number;
}

export interface GradeInput {
  timeMs: number;
  dodged: number;
  nearMisses: number;
  overdrives: number;
  hits: number;
  combo: number;
}

const GRADES: { min: number; letter: GradeLetter; label: string; color: string }[] = [
  { min: 900, letter: 'S', label: '厅里厅气', color: '#ffd43b' },
  { min: 620, letter: 'A', label: '处长苗子', color: '#8ce99a' },
  { min: 380, letter: 'B', label: '科班出身', color: '#74c0fc' },
  { min: 180, letter: 'C', label: '稳中带皮', color: '#ffa94d' },
  { min: 0, letter: 'D', label: '刚热身就下班', color: '#adb5bd' }
];

/**
 * 评分权重:
 * - 存活每 0.1 秒 1 分
 * - 翻越障碍 7 分,擦身 9 分,高光 16 分,最高连击 2 分
 * - 每次受击 -30 分
 * 目标区间:20s≈C,40s≈B,50s≈A,60s 高质量局≈S。
 */
export function gradeRun(input: GradeInput): RunGrade {
  const score = Math.max(0, Math.round(
    input.timeMs / 100 +
    input.dodged * 7 +
    input.nearMisses * 9 +
    input.overdrives * 16 +
    input.combo * 2 -
    input.hits * 30
  ));
  const grade = GRADES.find(g => score >= g.min) ?? GRADES[GRADES.length - 1];
  return { letter: grade.letter, label: grade.label, color: grade.color, score };
}
