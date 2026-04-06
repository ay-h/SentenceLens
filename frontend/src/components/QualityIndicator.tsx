import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface QualityIndicatorProps {
  qualityLevel?: string;
  confidence?: number;
  needsReview?: boolean;
  suspiciousWordsCount?: number;
}

export default function QualityIndicator({
  qualityLevel,
  confidence,
  needsReview,
  suspiciousWordsCount = 0
}: QualityIndicatorProps) {
  if (!qualityLevel || !confidence) {
    return null;
  }

  const getQualityColor = () => {
    switch (qualityLevel) {
      case 'high':
        return 'text-[var(--color-success)] bg-[var(--color-success-bg)]';
      case 'medium':
        return 'text-[var(--color-warning)] bg-[var(--color-warning-bg)]';
      case 'low':
      case 'unknown':
      default:
        return 'text-[var(--color-danger)] bg-[var(--color-danger-bg)]';
    }
  };

  const getQualityText = () => {
    switch (qualityLevel) {
      case 'high':
        return '识别质量：高';
      case 'medium':
        return '识别质量：中';
      case 'low':
      case 'unknown':
      default:
        return '识别质量：低';
    }
  };

  const qualityColorClass = getQualityColor();

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium ${qualityColorClass}`}
      title={`置信度: ${confidence.toFixed(1)}%, 低置信度单词: ${suspiciousWordsCount}`}
    >
      {needsReview ? (
        <AlertCircle size={16} />
      ) : (
        <CheckCircle2 size={16} />
      )}
      <span>{getQualityText()}</span>
      {suspiciousWordsCount > 0 && (
        <span className="ml-1 text-xs opacity-75">
          ({suspiciousWordsCount} 个低置信度单词)
        </span>
      )}
    </div>
  );
}
