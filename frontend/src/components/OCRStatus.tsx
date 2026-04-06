import { AlertCircle, CheckCircle2, Loader2, XCircle } from 'lucide-react';

interface OCRStatusProps {
  isProcessing?: boolean;
  step?: string;
  progress?: number;
  error?: string | null;
  qualityLevel?: string;
  processingTime?: number;
  onCancel?: () => void;
}

export default function OCRStatus({
  isProcessing = false,
  step,
  progress = 0,
  error,
  qualityLevel,
  processingTime,
  onCancel
}: OCRStatusProps) {
  if (!isProcessing && !error && !qualityLevel) {
    return null;
  }

  const getStepText = () => {
    switch (step) {
      case 'deskew':
        return '歪斜校正中...';
      case 'contrast':
        return '对比度调整中...';
      case 'sharpen':
        return '锐化中...';
      case 'denoise':
        return '降噪中...';
      case 'ocr':
        return 'OCR 识别中...';
      default:
        return step || '处理中...';
    }
  };

  const getQualityColor = () => {
    switch (qualityLevel) {
      case 'high':
        return 'text-[var(--color-success)]';
      case 'medium':
        return 'text-[var(--color-warning)]';
      case 'low':
        return 'text-[var(--color-danger)]';
      default:
        return 'text-[var(--color-text)]';
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-[var(--color-surface)] border-t border-[var(--color-border)]">
      {error && (
        <div className="flex items-center gap-2 text-[var(--color-danger)]">
          <XCircle size={16} />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {isProcessing && !error && (
        <div className="flex items-center gap-3">
          <Loader2 size={16} className="animate-spin text-[var(--color-primary)]" />
          <div className="flex flex-col">
            <span className="text-sm font-medium text-[var(--color-text)]">
              {getStepText()}
            </span>
            {progress > 0 && (
              <div className="w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-[var(--color-primary)] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-2 py-1 text-xs rounded border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors"
            >
              取消
            </button>
          )}
        </div>
      )}

      {!isProcessing && !error && qualityLevel && (
        <div className="flex items-center gap-2">
          {qualityLevel === 'high' ? (
            <CheckCircle2 size={16} className="text-[var(--color-success)]" />
          ) : qualityLevel === 'medium' ? (
            <AlertCircle size={16} className="text-[var(--color-warning)]" />
          ) : (
            <XCircle size={16} className="text-[var(--color-danger)]" />
          )}
          <div className="flex flex-col">
            <span className={`text-sm font-medium ${getQualityColor()}`}>
              OCR 识别完成
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">
              {qualityLevel === 'high' && '识别质量：高'}
              {qualityLevel === 'medium' && '识别质量：中'}
              {qualityLevel === 'low' && '识别质量：低，建议检查或重新拍摄'}
            </span>
            {processingTime && (
              <span className="text-xs text-[var(--color-text-muted)]">
                处理时间：{(processingTime / 1000).toFixed(1)}s
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
