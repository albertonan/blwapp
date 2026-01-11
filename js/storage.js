(function (global) {
  const STATE_KEY = "blwcare.state.v1";
  const LEGACY_HISTORY_KEY = "blwcare.history.v1";

  function safeParse(json, fallback) {
    try {
      return JSON.parse(json);
    } catch {
      return fallback;
    }
  }

  function isPlainObject(value) {
    if (!value || typeof value !== "object") return false;
    return Object.prototype.toString.call(value) === "[object Object]";
  }

  function mergeDeep(target, source) {
    if (!isPlainObject(target) || !isPlainObject(source)) return source;
    const out = { ...target };
    for (const [key, value] of Object.entries(source)) {
      if (isPlainObject(value) && isPlainObject(out[key])) {
        out[key] = mergeDeep(out[key], value);
      } else {
        out[key] = value;
      }
    }
    return out;
  }

  function nowIso() {
    try {
      return new Date().toISOString();
    } catch {
      return null;
    }
  }

  function getDefaultState() {
    return {
      version: 1,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      diary: {
        entries: []
      },
      allergens: {
        statuses: {}
      },
      milestones: {
        seated: false,
        noExtrusion: false,
        interestInFood: false,
        handToMouth: false
      },
      babyProfile: {
        birthDate: null,
        gestationWeeks: null,
        dueDate: null
      }
    };
  }

  function normalizeState(raw) {
    const defaults = getDefaultState();
    if (!raw || typeof raw !== "object") return defaults;
    if (raw.version !== 1) return defaults;

    const merged = mergeDeep(defaults, raw);
    merged.version = 1;
    merged.updatedAt = nowIso();
    return merged;
  }

  function readStateFromStorage() {
    const raw = safeParse(localStorage.getItem(STATE_KEY) || "null", null);
    return normalizeState(raw);
  }

  function writeStateToStorage(state) {
    const next = normalizeState(state);
    localStorage.setItem(STATE_KEY, JSON.stringify(next));
    return next;
  }

  function migrateLegacyIfNeeded() {
    const hasNew = !!localStorage.getItem(STATE_KEY);
    if (hasNew) return;

    const legacyHistory = safeParse(localStorage.getItem(LEGACY_HISTORY_KEY) || "null", null);
    if (!Array.isArray(legacyHistory) || legacyHistory.length === 0) return;

    const state = getDefaultState();
    state.diary.entries = legacyHistory;
    writeStateToStorage(state);
  }

  function ensureState() {
    migrateLegacyIfNeeded();
    const state = readStateFromStorage();
    if (!localStorage.getItem(STATE_KEY)) {
      writeStateToStorage(state);
    }
    return state;
  }

  function validateBackupState(candidate) {
    if (!candidate || typeof candidate !== "object") return { ok: false, error: "Formato inválido" };
    if (candidate.version !== 1) return { ok: false, error: "Versión no soportada" };
    if (!candidate.diary || typeof candidate.diary !== "object") return { ok: false, error: "Falta diary" };
    if (!candidate.allergens || typeof candidate.allergens !== "object") return { ok: false, error: "Falta allergens" };
    if (!candidate.milestones || typeof candidate.milestones !== "object") return { ok: false, error: "Falta milestones" };
    if (!candidate.babyProfile || typeof candidate.babyProfile !== "object") return { ok: false, error: "Falta babyProfile" };
    return { ok: true, error: null };
  }

  global.StorageApi = {
    getState() {
      return ensureState();
    },
    setState(partial) {
      const current = ensureState();
      const next = mergeDeep(current, isPlainObject(partial) ? partial : {});
      return writeStateToStorage(next);
    },
    resetState() {
      localStorage.removeItem(STATE_KEY);
      localStorage.removeItem(LEGACY_HISTORY_KEY);
      return ensureState();
    },

    exportState() {
      return ensureState();
    },

    importState(nextState) {
      const validation = validateBackupState(nextState);
      if (!validation.ok) {
        throw new Error(validation.error || "Backup inválido");
      }
      // Normaliza y guarda
      writeStateToStorage(nextState);
      return ensureState();
    },

    diary: {
      getEntries() {
        return ensureState().diary.entries || [];
      },
      setEntries(entries) {
        return global.StorageApi.setState({
          diary: { entries: Array.isArray(entries) ? entries : [] }
        });
      },
      addEntry(entry) {
        const current = ensureState();
        const entries = Array.isArray(current.diary.entries) ? current.diary.entries : [];
        return global.StorageApi.setState({
          diary: { entries: [...entries, entry] }
        });
      },
      upsertEntry(entry) {
        const current = ensureState();
        const entries = Array.isArray(current.diary.entries) ? current.diary.entries : [];
        if (!entry || typeof entry !== "object" || !entry.id) {
          return global.StorageApi.setState({ diary: { entries } });
        }
        const idx = entries.findIndex((e) => e && typeof e === "object" && e.id === entry.id);
        const next = idx >= 0 ? [...entries.slice(0, idx), entry, ...entries.slice(idx + 1)] : [...entries, entry];
        return global.StorageApi.setState({
          diary: { entries: next }
        });
      },
      deleteEntry(entryId) {
        const current = ensureState();
        const entries = Array.isArray(current.diary.entries) ? current.diary.entries : [];
        const next = entries.filter((e) => !(e && typeof e === "object" && e.id === entryId));
        return global.StorageApi.setState({
          diary: { entries: next }
        });
      }
    },

    allergens: {
      getAll() {
        return ensureState().allergens.statuses || {};
      },
      getStatus(allergenId) {
        const statuses = ensureState().allergens.statuses || {};
        return statuses[allergenId] || "not_introduced";
      },
      setStatus(allergenId, status) {
        if (!allergenId) return ensureState();
        const current = ensureState();
        const statuses = isPlainObject(current.allergens.statuses) ? current.allergens.statuses : {};
        return global.StorageApi.setState({
          allergens: {
            statuses: { ...statuses, [allergenId]: status }
          }
        });
      }
    },

    milestones: {
      getAll() {
        return ensureState().milestones;
      },
      set(partial) {
        return global.StorageApi.setState({
          milestones: isPlainObject(partial) ? partial : {}
        });
      },
      isComplete() {
        const m = ensureState().milestones;
        return !!(m.seated && m.noExtrusion && m.interestInFood && m.handToMouth);
      }
    },

    babyProfile: {
      get() {
        return ensureState().babyProfile;
      },
      set(partial) {
        return global.StorageApi.setState({
          babyProfile: isPlainObject(partial) ? partial : {}
        });
      }
    },

    // Backward-compatible wrappers (legacy API name)
    getHistory() {
      return global.StorageApi.diary.getEntries();
    },
    setHistory(items) {
      return global.StorageApi.diary.setEntries(items);
    }
  };
})(typeof window !== "undefined" ? window : self);
