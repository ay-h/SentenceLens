import { useState, useEffect } from 'react';
import { ArrowLeft, Save, Loader2, HardDriveDownload, FolderOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import * as api from '@/api';
import type { LLMConfig } from '@/types';

export default function Settings() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<LLMConfig>({ url: '', api_key: '', model: '' });
  const [saving, setSaving] = useState(false);
  const [autoShowTranslation, setAutoShowTranslation] = useState(() => {
    return localStorage.getItem('autoShowTranslation') === 'true';
  });
  const [dataDir, setDataDir] = useState('');
  const [changingDir, setChangingDir] = useState(false);
  const [openingExisting, setOpeningExisting] = useState(false);

  const isElectron = typeof window !== 'undefined' && Boolean(window.electronAPI);

  useEffect(() => {
    api.getLLMConfig()
      .then(c => setConfig(c))
      .catch(() => { /* no config yet */ });
  }, []);

  useEffect(() => {
    if (!isElectron) return;
    window.electronAPI?.getAppDataDir?.()
      .then(dir => setDataDir(dir))
      .catch(() => setDataDir(''));
  }, [isElectron]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!config.url.trim() || !config.api_key.trim() || !config.model.trim()) {
      toast.error('请填写所有配置项');
      return;
    }
    setSaving(true);
    try {
      await api.saveLLMConfig(config);
      toast.success('配置已保存');
    } catch (err: unknown) {
      toast.error(`保存失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleUseExistingDir() {
    if (!isElectron || !window.electronAPI?.useExistingDataDir) {
      toast.error('当前环境不支持切换已有目录');
      return;
    }

    setOpeningExisting(true);
    try {
      const result = await window.electronAPI.useExistingDataDir();
      if (result.canceled) {
        toast.info('已取消选择目录');
        return;
      }

      if (result.success) {
        toast.success('已切换到指定数据目录，应用即将重启');
        setDataDir(result.newDir ?? dataDir);
      } else {
        toast.error(`切换失败: ${result.error || '未知错误'}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      toast.error(`切换失败: ${message}`);
    } finally {
      setOpeningExisting(false);
    }
  }

  function handleSaveTranslation(e: React.FormEvent) {
    e.preventDefault();
    localStorage.setItem('autoShowTranslation', String(autoShowTranslation));
    toast.success('翻译设置已保存');
  }

  async function handleChangeDataDir() {
    if (!isElectron || !window.electronAPI?.changeDataDir) {
      toast.error('当前环境不支持修改数据目录');
      return;
    }

    setChangingDir(true);
    try {
      const result = await window.electronAPI.changeDataDir();
      if (result.canceled) {
        toast.info('已取消选择目录');
        return;
      }

      if (result.success) {
        if (result.cleanupWarning) {
          toast.warning(`目录迁移完成，但 ${result.cleanupWarning}`);
        } else {
          toast.success('数据目录已更新，应用即将重启');
        }
        setDataDir(result.newDir ?? dataDir);
      } else {
        toast.error(`修改失败: ${result.error || '未知错误'}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      toast.error(`修改失败: ${message}`);
    } finally {
      setChangingDir(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-secondary)]">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 h-14 bg-white border-b border-[var(--color-border)]">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--color-text-secondary)] rounded-md hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={16} />
          返回主页
        </button>
        <h1 className="text-lg font-semibold">设置</h1>
      </header>

      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {isElectron && (
          <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
            <h2 className="text-base font-semibold mb-1">数据存储位置</h2>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              应用会在该目录下存储数据库文件和上传的图片。迁移时目标目录必须为空，如需打开已有数据，请使用下方“切换到已有数据目录”。
            </p>

            <div className="space-y-4">
              <div>
                <span className="block text-sm font-medium mb-1">当前目录</span>
                <code className="block px-3 py-2 text-xs bg-gray-100 rounded border border-dashed border-gray-300 break-all">
                  {dataDir || '获取中...'}
                </code>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleChangeDataDir}
                  disabled={changingDir || openingExisting}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50"
                >
                  {changingDir ? <Loader2 size={14} className="animate-spin" /> : <HardDriveDownload size={14} />}
                  迁移到新的空目录
                </button>

                <button
                  onClick={handleUseExistingDir}
                  disabled={changingDir || openingExisting}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm border border-[var(--color-border)] text-[var(--color-text-secondary)] rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  {openingExisting ? <Loader2 size={14} className="animate-spin" /> : <FolderOpen size={14} />}
                  切换到已有数据目录
                </button>
              </div>
              <p className="text-xs text-[var(--color-text-muted)]">
                迁移：复制当前数据到新目录，确保目录为空；切换：直接指向已有有效数据目录。
              </p>
            </div>
          </div>
        )}

        {/* LLM Config */}
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
          <h2 className="text-base font-semibold mb-1">LLM 配置</h2>
          <p className="text-sm text-[var(--color-text-muted)] mb-4">
            配置用于句子结构分析的大语言模型。支持 OpenAI 兼容的 API（如 DeepSeek）。
          </p>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">API 地址</label>
              <input
                type="url"
                value={config.url}
                onChange={e => setConfig(prev => ({ ...prev, url: e.target.value }))}
                placeholder="https://api.deepseek.com"
                required
                className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg outline-none focus:border-[var(--color-primary)] transition-colors"
              />
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                API 基础地址，例如: https://api.deepseek.com
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">API Key</label>
              <input
                type="password"
                value={config.api_key}
                onChange={e => setConfig(prev => ({ ...prev, api_key: e.target.value }))}
                placeholder="sk-..."
                required
                className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg outline-none focus:border-[var(--color-primary)] transition-colors"
              />
              <p className="text-xs text-[var(--color-text-muted)] mt-1">您的 API 密钥</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">模型名称</label>
              <input
                type="text"
                value={config.model}
                onChange={e => setConfig(prev => ({ ...prev, model: e.target.value }))}
                placeholder="deepseek-chat"
                required
                className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg outline-none focus:border-[var(--color-primary)] transition-colors"
              />
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                要使用的模型名称，例如: deepseek-chat, gpt-4
              </p>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              保存配置
            </button>
          </form>
        </div>

        {/* Translation Config */}
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
          <h2 className="text-base font-semibold mb-1">翻译设置</h2>
          <p className="text-sm text-[var(--color-text-muted)] mb-4">
            配置文本翻译功能的默认行为。
          </p>

          <form onSubmit={handleSaveTranslation} className="space-y-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoShowTranslation}
                onChange={e => setAutoShowTranslation(e.target.checked)}
                className="rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
              />
              <span className="text-sm">自动显示翻译</span>
            </label>
            <p className="text-xs text-[var(--color-text-muted)]">
              翻译完成后自动显示翻译内容，否则需要手动开启
            </p>

            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-hover)] transition-colors"
            >
              <Save size={14} />
              保存翻译设置
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
