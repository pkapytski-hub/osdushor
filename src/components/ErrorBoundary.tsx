import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { failed: boolean };

/**
 * Без границы ошибки любая ошибка рендера (или неудачная загрузка чанка раздела)
 * размонтирует всё дерево и посетитель видит пустой белый экран без подсказки,
 * что делать. Здесь вместо этого — короткое объяснение и кнопка обновления.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("render_failed", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-mist px-6 py-16">
        <div className="max-w-md text-center">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-graphite-500">Ошибка загрузки</p>
          <h1 className="mt-3 font-display text-2xl text-navy-900 sm:text-3xl">Страница не открылась</h1>
          <p className="mt-3 text-sm leading-relaxed text-graphite-600">
            Скорее всего, сайт обновился, пока страница была открыта. Нажмите «Обновить страницу» — обычно этого
            достаточно.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              Обновить страницу
            </button>
            <a href="/" className="btn btn-outline">
              На главную
            </a>
          </div>
        </div>
      </div>
    );
  }
}
