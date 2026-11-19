import { StatusCard } from '../components/StatusCard';
import { useSystemStatus } from '../hooks/useSystemStatus';
import { monitoringLabel } from '../services/statusLabel';

export function Dashboard() {
  const { snapshot, connection } = useSystemStatus();
  const connected = connection === 'online';
  const connectionLabel = { online: 'API підключено', offline: 'З’єднання втрачено', loading: 'Підключення…' }[connection];

  return <main className="mx-auto max-w-7xl px-5 py-8 md:px-10 md:py-12">
    <header className="flex flex-wrap items-center justify-between gap-5">
      <div className="brand"><span className="brand-mark" aria-hidden="true">K</span><div><h1>KYIV ALERT</h1><p className="eyebrow">Панель моніторингу · Київ</p></div></div>
      <span className="connection" role="status"><span className={connected ? 'dot online' : 'dot'} />{connectionLabel}</span>
    </header>

    <section className="demo-banner flex flex-wrap items-center justify-between gap-4">
      <div><p className="eyebrow">DEMO MODE</p><h2>Локальна розробка</h2><p>Демонстраційні дані. Моніторинг реальних джерел зупинено.</p></div>
      <span className="demo-symbol" aria-hidden="true">◉</span>
    </section>

    <div className="grid gap-4 md:grid-cols-3" aria-live="polite">
      <StatusCard label="Система" value={connected ? 'DEMO готова' : 'Очікування API'} detail={connected ? 'Отримано відповідь сервера' : 'Перевірте локальний backend'} />
      <StatusCard label="Telegram" value={connected && snapshot?.telegramStatus === 'NOT_CONFIGURED' ? 'Не налаштовано' : 'Стан невідомий'} detail="Підключення бота заплановано на етапі 5" />
      <StatusCard label="Моніторинг" value={monitoringLabel(snapshot?.monitoringStatus, connected)} detail="Збір повідомлень вимкнено" warning />
    </div>

    {!connected && snapshot && <p className="error" role="alert">Показано останню отриману відповідь. Поточний стан системи невідомий.</p>}

    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_2fr]">
      <section className="panel"><h2>Джерела</h2><p className="muted">Дозволені джерела даних</p>
        {snapshot?.sources.map(source => <div className="source" key={source.name}><span>{source.name}</span><span className="tag">{source.status}</span></div>)}
        {!snapshot && <p className="empty">Джерела з’являться після підключення API.</p>}
      </section>
      <section className="panel"><h2>Історія повідомлень</h2><p className="muted">Оригінальний текст та походження</p>
        {snapshot?.messages.map(message => <article className="message" key={message.id}>
          <div className="flex flex-wrap items-center gap-3"><span className="tag">{message.isTest ? 'ТЕСТ' : 'ПОВІДОМЛЕННЯ'}</span><span className="muted">{message.classification}</span><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString('uk-UA')}</time></div>
          <p>{message.text}</p>
          <small>Джерело · {message.sourceName}</small>
          {message.originalUrl && <a href={message.originalUrl} target="_blank" rel="noreferrer">Відкрити оригінал</a>}
        </article>)}
        {!snapshot && <p className="empty">Очікуємо демонстраційні повідомлення.</p>}
      </section>
    </div>
    <section className="panel mt-6"><h2>Звукове сповіщення</h2><p className="muted">Налаштування сирени та тестування звуку будуть доступні на етапі 7.</p></section>
    <footer className="flex flex-wrap justify-between gap-3"><span>KYIV ALERT · Development 0.1</span><span>{snapshot ? `Останнє оновлення ${new Date(snapshot.checkedAt).toLocaleTimeString('uk-UA')}` : 'Очікування першого оновлення'}</span></footer>
  </main>;
}
