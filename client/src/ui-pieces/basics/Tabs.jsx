// Tabs that behave the way screen readers expect: the tabs sit in one row, the left and right
// arrow keys move between them, and only the chosen tab is reachable with Tab, so the next press
// goes into its panel rather than through every other tab.
//
//   <Tabs label="Course sections" tabs={[{ id: 'overview', label: 'Overview', content: <Overview /> }, ...]}>
//     <h1>Heading shown above the tabs, in the same card</h1>
//   </Tabs>
import { useRef, useState } from 'react';

export default function Tabs({ label, tabs, children }) {
  const [selectedId, setSelectedId] = useState(tabs[0].id);
  const buttons = useRef({});
  const selected = tabs.find((tab) => tab.id === selectedId) ?? tabs[0];

  function onKeyDown(event, index) {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    const next = tabs[(index + step + tabs.length) % tabs.length];
    setSelectedId(next.id);
    buttons.current[next.id]?.focus();
  }

  return (
    <>
      <section className="card">
        {children}
        <div className="tabs" role="tablist" aria-label={label}>
          {tabs.map((tab, index) => {
            const isSelected = tab.id === selected.id;
            return (
              <button
                key={tab.id}
                ref={(element) => {
                  buttons.current[tab.id] = element;
                }}
                className="tab"
                type="button"
                role="tab"
                id={`tab-${tab.id}`}
                aria-controls={`panel-${tab.id}`}
                aria-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => setSelectedId(tab.id)}
                onKeyDown={(event) => onKeyDown(event, index)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>
      <section className="card" role="tabpanel" id={`panel-${selected.id}`} aria-labelledby={`tab-${selected.id}`}>
        {selected.content}
      </section>
    </>
  );
}
