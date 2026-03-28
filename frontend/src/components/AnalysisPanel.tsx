import { X } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import type { AnalysisData } from '@/types';

const COMPONENT_COLORS: Record<string, string> = {
  '主语': 'var(--color-subject)',
  '谓语': 'var(--color-predicate)',
  '宾语': 'var(--color-object)',
  '表语': 'var(--color-predicative)',
  '宾补': 'var(--color-complement)',
  '间接宾语': 'var(--color-indirect-object)',
};

const MODIFIER_COLORS: Record<string, string> = {
  '定语': 'var(--color-attributive)',
  '状语': 'var(--color-adverbial)',
};

function ComponentTag({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-block px-2 py-0.5 text-xs font-medium text-white rounded mr-2 shrink-0"
      style={{ backgroundColor: color }}
    >
      {label}
    </span>
  );
}

function ComponentItem({ label, text, explanation, color, extra }: {
  label: string; text: string; explanation: string; color: string; extra?: React.ReactNode;
}) {
  if (!text) return null;
  return (
    <div className="bg-white rounded-lg border border-[var(--color-border)] p-3 mb-2">
      <div className="flex items-center flex-wrap gap-1 mb-1.5">
        <ComponentTag label={label} color={color} />
        <code className="text-sm bg-gray-50 px-1.5 py-0.5 rounded text-[var(--color-text-primary)]">
          {text}
        </code>
        {extra}
      </div>
      <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{explanation}</p>
    </div>
  );
}

function TenseBadge({ tense }: { tense: string }) {
  return (
    <span className="text-xs text-[var(--color-text-muted)] bg-gray-100 px-1.5 py-0.5 rounded ml-1">
      {tense}
    </span>
  );
}

function AnalysisContent({ data }: { data: AnalysisData }) {
  return (
    <div className="space-y-4">
      {/* Translation + Pattern */}
      {data.sentence_overview?.translation && (
        <div>
          <p className="text-base text-[var(--color-text-primary)] font-medium leading-relaxed">
            {data.sentence_overview.translation}
          </p>
          {data.sentence_overview.sentence_pattern && (
            <span className="inline-block mt-2 px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-medium">
              {data.sentence_overview.sentence_pattern}
            </span>
          )}
        </div>
      )}

      {/* Main Clause */}
      {data.main_clause && (
        <div>
          <h4 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text-primary)] mb-3">
            <span>🔍</span> 句子主干
          </h4>
          <div className="bg-gray-50 rounded-lg px-3 py-2 mb-3 text-sm">
            <strong>核心主干：</strong>
            <span className="text-[var(--color-text-primary)]">{data.main_clause.text}</span>
          </div>

          {data.main_clause.subject?.text && (
            <ComponentItem
              label="主语" text={data.main_clause.subject.text}
              explanation={data.main_clause.subject.explanation}
              color={COMPONENT_COLORS['主语']}
            />
          )}
          {data.main_clause.predicate?.text && (
            <ComponentItem
              label="谓语" text={data.main_clause.predicate.text}
              explanation={data.main_clause.predicate.explanation}
              color={COMPONENT_COLORS['谓语']}
              extra={data.main_clause.predicate.tense ? <TenseBadge tense={data.main_clause.predicate.tense} /> : undefined}
            />
          )}
          {data.main_clause.object?.text && (
            <ComponentItem
              label="宾语" text={data.main_clause.object.text}
              explanation={data.main_clause.object.explanation}
              color={COMPONENT_COLORS['宾语']}
            />
          )}
          {data.main_clause.predicative?.text && (
            <ComponentItem
              label="表语" text={data.main_clause.predicative.text}
              explanation={data.main_clause.predicative.explanation}
              color={COMPONENT_COLORS['表语']}
            />
          )}
          {data.main_clause.indirect_object?.text && (
            <ComponentItem
              label="间接宾语" text={data.main_clause.indirect_object.text}
              explanation={data.main_clause.indirect_object.explanation}
              color={COMPONENT_COLORS['间接宾语']}
            />
          )}
          {data.main_clause.object_complement?.text && (
            <ComponentItem
              label="宾补" text={data.main_clause.object_complement.text}
              explanation={data.main_clause.object_complement.explanation}
              color={COMPONENT_COLORS['宾补']}
            />
          )}
        </div>
      )}

      {/* Modifiers */}
      {data.modifiers && data.modifiers.length > 0 && (
        <div>
          <h4 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text-primary)] mb-3">
            <span>🎨</span> 修饰成分分析
          </h4>
          <div className="space-y-2">
            {data.modifiers.map((mod, i) => (
              <div key={i} className="bg-white rounded-lg border border-[var(--color-border)] p-3"
                style={{ borderLeftWidth: '3px', borderLeftColor: MODIFIER_COLORS[mod.type] || '#ff9800' }}>
                <div className="flex items-center flex-wrap gap-1.5 mb-1.5">
                  <span
                    className="inline-block px-2 py-0.5 text-xs font-medium text-white rounded"
                    style={{ backgroundColor: MODIFIER_COLORS[mod.type] || '#ff9800' }}
                  >
                    {mod.type}
                  </span>
                  {mod.sub_type && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                      {mod.sub_type}
                    </span>
                  )}
                  <code className="text-xs bg-gray-50 px-1.5 py-0.5 rounded">{mod.text}</code>
                  <span className="text-xs text-gray-400 italic">→ {mod.target}</span>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{mod.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subordinate Clauses */}
      {data.subordinate_clauses && data.subordinate_clauses.length > 0 && (
        <div>
          <h4 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text-primary)] mb-3">
            <span>🔗</span> 从句分析
          </h4>
          <div className="space-y-2">
            {data.subordinate_clauses.map((clause, i) => (
              <div key={i} className="bg-white rounded-lg border border-[var(--color-border)] p-3"
                style={{ borderLeftWidth: '3px', borderLeftColor: '#6c757d' }}>
                <div className="flex items-center flex-wrap gap-1.5 mb-1.5">
                  <span className="inline-block px-2 py-0.5 text-xs font-medium text-white rounded bg-gray-500">
                    {clause.type}
                  </span>
                  <code className="text-xs bg-gray-50 px-1.5 py-0.5 rounded">{clause.text}</code>
                </div>
                {clause.function && (
                  <p className="text-xs text-[var(--color-primary)] font-medium mb-1">
                    充当成分：{clause.function}
                  </p>
                )}
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{clause.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Structure Explanation */}
      {data.structure_explanation && (
        <div>
          <h4 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text-primary)] mb-3">
            <span>📋</span> 结构解析
          </h4>
          <div className="bg-blue-50 rounded-lg p-3 mb-2">
            <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">
              💡 {data.structure_explanation.summary}
            </p>
          </div>
          {data.structure_explanation.key_points && data.structure_explanation.key_points.length > 0 && (
            <div className="space-y-1">
              {data.structure_explanation.key_points.map((point, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
                  <span className="text-[var(--color-primary)] font-medium shrink-0">{i + 1}.</span>
                  <span>{point}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {data.error && (
        <div className="bg-red-50 text-[var(--color-danger)] rounded-lg p-3 text-sm">
          {data.error}
        </div>
      )}
    </div>
  );
}

export default function AnalysisPanel() {
  const { analysisVisible, selectedAnalysis, closeAnalysis } = useApp();

  if (!analysisVisible || !selectedAnalysis) return null;

  return (
    <div className="w-[380px] min-w-[380px] border-l border-[var(--color-border)] bg-white flex flex-col shrink-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] shrink-0">
        <span className="text-sm font-semibold">分析结果</span>
        <button
          onClick={closeAnalysis}
          className="p-1 rounded hover:bg-gray-100 text-[var(--color-text-muted)]"
        >
          <X size={16} />
        </button>
      </div>
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <AnalysisContent data={selectedAnalysis.analysis} />
      </div>
    </div>
  );
}
