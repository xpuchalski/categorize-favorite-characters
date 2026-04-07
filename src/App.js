import React, { useState, useEffect } from 'react';
import './App.css';

const COLOR_COLUMNS = ['black', 'gray', 'blue', 'purple', 'green', 'brown', 'yellow', 'orange', 'red', 'pink', 'white'];

function normalizeColor(value) {
  const normalized = (value || '').trim().toLowerCase();
  return COLOR_COLUMNS.includes(normalized) ? normalized : 'gray';
}

function normalizeFacetKey(value) {
  return (value || '').trim().toLowerCase();
}

function normalizeFacetValue(value) {
  return (value || '').trim().toLowerCase();
}

function parseTaggedFacetLine(line) {
  const trimmed = (line || '').trim();
  if (!trimmed.startsWith(':')) return null;

  const body = trimmed.slice(1).trim();
  const separatorIndex = body.indexOf(':');
  if (separatorIndex <= 0) return null;

  const key = normalizeFacetKey(body.slice(0, separatorIndex));
  const value = normalizeFacetValue(body.slice(separatorIndex + 1));
  if (!key || !value) return null;

  return { key, value };
}

/**
 * Parses characters.txt into an array of columns.
 * Each block separated by a blank line becomes one column.
 * The first non-empty line is the column name.
 * Under each character, first plain color line is treated as color.
 * Additional metadata lines can be user-defined as :key:value pairs.
 */
function parseCharactersTxt(text) {
  const blocks = text.trim().split(/\n[ \t]*\n/);
  return blocks
    .map(block => {
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 1) return null;
      const [name, ...rawEntries] = lines;
      const entries = [];

      let i = 0;
      while (i < rawEntries.length) {
        const characterName = rawEntries[i];
        i += 1;
        if (!characterName) continue;

        const facets = {};
        const maybeColor = rawEntries[i];

        if (COLOR_COLUMNS.includes((maybeColor || '').toLowerCase())) {
          facets.color = normalizeColor(maybeColor);
          i += 1;
        }

        while (i < rawEntries.length) {
          const taggedFacet = parseTaggedFacetLine(rawEntries[i]);
          if (!taggedFacet) break;

          facets[taggedFacet.key] = taggedFacet.key === 'color'
            ? normalizeColor(taggedFacet.value)
            : taggedFacet.value;
          i += 1;
        }

        entries.push({
          name: characterName,
          facets: {
            color: facets.color || 'gray',
            ...facets,
          },
          category: name,
        });
      }

      return { name, entries };
    })
    .filter(Boolean);
}

/**
 * Fetches the first scraped image result from the backend.
 * Query includes both column and row value, plus "fanart".
 */
async function fetchScrapedImage(columnName, entry) {
  const query = `${columnName} ${entry} fanart`;

  try {
    const params = new URLSearchParams({ q: query });
    const res = await fetch(`/api/image-search?${params}`);
    const payload = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { imageUrl: null, candidates: [], error: payload.error || 'Search failed' };
    }

    return {
      imageUrl: payload.imageUrl ?? null,
      candidates: Array.isArray(payload.candidates) ? payload.candidates : [],
      error: null,
    };
  } catch {
    return { imageUrl: null, candidates: [], error: 'Could not reach image search API' };
  }
}

/** A single data cell that fetches and toggles its image on click. */
function CharacterCell({ columnName, entry }) {
  // undefined = not yet fetched, null = fetched but no result, string = image URL
  const [image, setImage] = useState(undefined);
  const [candidates, setCandidates] = useState([]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [lookupError, setLookupError] = useState(null);

  const handleClick = async () => {
    const next = !open;
    setOpen(next);
    if (next && image === undefined) {
      setLoading(true);
      const result = await fetchScrapedImage(columnName, entry.name);
      setImage(result.imageUrl);
      setCandidates(result.candidates);
      setCandidateIndex(0);
      setLookupError(result.error);
      setLoading(false);
    }
  };

  const handleNextImage = (event) => {
    event.stopPropagation();
    if (!candidates.length) return;

    const next = (candidateIndex + 1) % candidates.length;
    setCandidateIndex(next);
    setImage(candidates[next]);
    setLookupError(null);
  };

  return (
    <td
      className={`char-cell${open ? ' open' : ''}`}
      onClick={handleClick}
      title={open ? 'Click to collapse' : 'Click to reveal image'}
    >
      <span className="char-name">{entry.name}</span>
      <span className="char-color">{entry.facets.color}</span>
      {open && (
        <div className="char-image">
          {loading ? (
            <div className="loading-text">Loading…</div>
          ) : image ? (
            <>
              <img src={image} alt={`${columnName} - ${entry.name}`} />
              {candidates.length > 1 && (
                <button type="button" className="next-image-btn" onClick={handleNextImage}>
                  Wrong image? Try next ({candidateIndex + 1}/{candidates.length})
                </button>
              )}
            </>
          ) : (
            <div className="no-image">{lookupError || 'No image found'}</div>
          )}
        </div>
      )}
    </td>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('gallery');
  const [columns, setColumns] = useState([]);
  const [rawText, setRawText] = useState('');
  const [editorText, setEditorText] = useState('');
  const [error, setError] = useState(null);
  const [saveErrorMessage, setSaveErrorMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('idle');

  const loadCharacters = () => {
    setLoading(true);
    setError(null);

    return fetch('/api/characters')
      .then(res => {
        if (!res.ok) throw new Error(`Could not load characters.txt (${res.status})`);
        return res.text();
      })
      .then(text => {
        setRawText(text);
        setEditorText(text);
        setColumns(parseCharactersTxt(text));
        setLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadCharacters();
  }, []);

  const handleSave = async () => {
    setSaveStatus('saving');
    setSaveErrorMessage('');
    try {
      const res = await fetch('/api/characters', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editorText }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        let message = body || `Save failed (${res.status})`;
        try {
          const parsed = JSON.parse(body);
          if (parsed?.error) message = parsed.error;
        } catch {
          // Keep plain text message.
        }
        throw new Error(message);
      }

      setRawText(editorText);
      setColumns(parseCharactersTxt(editorText));
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1200);
    } catch (e) {
      setSaveErrorMessage(e?.message || 'Save failed.');
      setSaveStatus('error');
    }
  };

  const hasUnsavedChanges = editorText !== rawText;

  const handleDownload = () => {
    const blob = new Blob([editorText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'characters.txt';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const maxRows = Math.max(...columns.map(c => c.entries.length), 0);
  const allEntries = columns.flatMap(column =>
    column.entries.map(entry => ({ ...entry, category: column.name }))
  );
  const allFacetKeys = Array.from(new Set(allEntries.flatMap(entry => Object.keys(entry.facets || {}))));
  const dynamicFacetKeys = allFacetKeys
    .filter(key => key !== 'color')
    .sort((a, b) => a.localeCompare(b));
  const facetTabs = ['color', ...dynamicFacetKeys];

  const activeFacet = activeTab.startsWith('facet:') ? activeTab.replace('facet:', '') : null;
  const facetColumns = activeFacet === 'color'
    ? COLOR_COLUMNS
    : Array.from(
        new Set(
          allEntries
            .map(entry => entry.facets?.[activeFacet])
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b));
  const groupedFacetEntries = facetColumns.reduce((acc, facetValue) => {
    acc[facetValue] = allEntries.filter(entry => (entry.facets?.[activeFacet] || '') === facetValue);
    return acc;
  }, {});
  const facetRows = Math.max(...facetColumns.map(facetValue => groupedFacetEntries[facetValue].length), 0);

  useEffect(() => {
    if (!activeFacet) return;
    if (!facetTabs.includes(activeFacet)) setActiveTab('gallery');
  }, [activeFacet, facetTabs]);

  if (loading) return <div className="status">Loading…</div>;
  if (error)   return <div className="status error">{error}</div>;

  return (
    <div className="app">
      <h1>Character Gallery</h1>
      <p className="hint">Color is the line below each character. Add custom tags as :key:value lines (example: :personality: calm, :gender: female) to create new pages. Other line formats are ignored as tags.</p>

      <div className="tabs">
        <button
          type="button"
          className={`tab-btn${activeTab === 'gallery' ? ' active' : ''}`}
          onClick={() => setActiveTab('gallery')}
        >
          Gallery
        </button>
        {facetTabs.map(facet => (
          <button
            key={facet}
            type="button"
            className={`tab-btn${activeTab === `facet:${facet}` ? ' active' : ''}`}
            onClick={() => setActiveTab(`facet:${facet}`)}
          >
            {facet === 'color' ? 'Color Sort' : facet[0].toUpperCase() + facet.slice(1)}
          </button>
        ))}
        <button
          type="button"
          className={`tab-btn${activeTab === 'editor' ? ' active' : ''}`}
          onClick={() => setActiveTab('editor')}
        >
          Edit chars.txt
        </button>
      </div>

      {activeTab === 'gallery' ? (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                {columns.map(col => (
                  <th key={col.name}>{col.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: maxRows }, (_, i) => (
                <tr key={i}>
                  {columns.map(col =>
                    col.entries[i] ? (
                      <CharacterCell
                        key={col.name}
                        columnName={col.name}
                        entry={col.entries[i]}
                      />
                    ) : (
                      <td key={col.name} className="empty-cell" />
                    )
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : activeFacet ? (
        <div className="table-wrapper color-table-wrap">
          <table className="color-table facet-table">
            <thead>
              <tr>
                {facetColumns.map(facetValue => (
                  <th
                    key={facetValue}
                    className={`color-col-head${activeFacet === 'color' ? ` color-${facetValue}` : ''}`}
                  >
                    {facetValue}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: facetRows }, (_, rowIndex) => (
                <tr key={rowIndex}>
                  {facetColumns.map(facetValue => {
                    const item = groupedFacetEntries[facetValue][rowIndex];
                    return (
                      <td
                        key={`${facetValue}-${rowIndex}`}
                        className={`color-cell${activeFacet === 'color' ? ` color-${facetValue}` : ''}`}
                      >
                        {item ? (
                          <>
                            <span className="color-name">{item.name}</span>
                            <span className="color-category">{item.category}</span>
                          </>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="editor-panel">
          <textarea
            value={editorText}
            onChange={e => setEditorText(e.target.value)}
            spellCheck={false}
            aria-label="Edit characters text"
          />
          <div className="editor-actions">
            <button type="button" onClick={handleSave} disabled={!hasUnsavedChanges || saveStatus === 'saving'}>
              {saveStatus === 'saving' ? 'Saving...' : 'Save chars.txt'}
            </button>
            <button type="button" onClick={loadCharacters}>
              Reload from disk
            </button>
            <button type="button" onClick={handleDownload}>
              Download characters.txt
            </button>
            {saveStatus === 'saved' && <span className="save-ok">Saved.</span>}
            {saveStatus === 'error' && <span className="save-error">{saveErrorMessage || 'Save failed.'}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
