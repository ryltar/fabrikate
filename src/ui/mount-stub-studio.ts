import type {
	FetchClient,
	StubManager,
	StubPostGeneratedFieldsJsonInput,
} from "../types";

export interface StubStudioOptions {
	title?: string;
	className?: string;
	documentationUrl?: string;
	documentationTarget?: "_blank" | "_self";
	documentationLinks?: Array<{ label: string; url: string; target?: "_blank" | "_self" }>;
}

export interface StubStudioController {
	refresh(): void;
	destroy(): void;
}

export interface StubStudioDrawerOptions extends StubStudioOptions {
	position?: "bottom-right" | "bottom-left";
	initiallyOpen?: boolean;
	launcherLabel?: string;
	widthPx?: number;
}

const STYLE_ID = "fabricate-studio-style";

interface AdvancedModeStore {
	get(): boolean;
	set(next: boolean): void;
	subscribe(listener: (advanced: boolean) => void): () => void;
}

function createAdvancedModeStore(initial = false): AdvancedModeStore {
	let advanced = initial;
	const listeners = new Set<(value: boolean) => void>();

	return {
		get() {
			return advanced;
		},
		set(next) {
			if (advanced === next) {
				return;
			}

			advanced = next;
			listeners.forEach((listener) => listener(advanced));
		},
		subscribe(listener) {
			listeners.add(listener);
			listener(advanced);
			return () => {
				listeners.delete(listener);
			};
		},
	};
}

function createAutoRefreshStore(initial = false): AdvancedModeStore {
	let enabled = initial;
	const listeners = new Set<(value: boolean) => void>();

	return {
		get() {
			return enabled;
		},
		set(next) {
			if (enabled === next) {
				return;
			}

			enabled = next;
			listeners.forEach((listener) => listener(enabled));
		},
		subscribe(listener) {
			listeners.add(listener);
			listener(enabled);
			return () => {
				listeners.delete(listener);
			};
		},
	};
}

export function mountStubStudio(
	container: HTMLElement,
	client: FetchClient,
	options: StubStudioOptions = {},
): StubStudioController {
	const manager = client.stubManager;
	const advancedModeStore = createAdvancedModeStore(false);
	const autoRefreshStore = createAutoRefreshStore(true);
	ensureStyle();

	container.innerHTML = "";
	container.classList.add("tfs-studio-host");

	const root = document.createElement("section");
	root.className = ["tfs-studio", options.className ?? ""].filter(Boolean).join(" ");

	if (!manager) {
		root.append(
			renderMessage(
				"Stub Studio unavailable",
				"Enable devMode: true when creating the fetch client to use this panel.",
			),
		);
		container.append(root);
		return {
			refresh() {
				return;
			},
			destroy() {
				container.innerHTML = "";
			},
		};
	}

	const header = renderHeader(
		options.title ?? "Stub Studio",
		manager,
		options.documentationUrl,
		options.documentationTarget,
		advancedModeStore,
		autoRefreshStore,
		options.documentationLinks,
	);
	const content = document.createElement("div");
	content.className = "tfs-studio-content";

	const storagePanel = renderStoragePanel(manager, advancedModeStore);
	const mappingPanel = renderMappingPanel(manager, advancedModeStore);
	const scenariosPanel = renderScenariosPanel(manager, () => {
		storagePanel.refresh();
		mappingPanel.refresh();
	});

	content.append(scenariosPanel.section, storagePanel.section, mappingPanel.section);
	root.append(header.element, content);
	container.append(root);

	const refresh = () => {
		storagePanel.refresh();
		mappingPanel.refresh();
	};

	refresh();

	let autoRefreshInterval: number | undefined;
	const unsubscribeAutoRefresh = autoRefreshStore.subscribe((enabled) => {
		if (autoRefreshInterval !== undefined) {
			clearInterval(autoRefreshInterval);
			autoRefreshInterval = undefined;
		}

		if (enabled) {
			autoRefreshInterval = window.setInterval(refresh, 5000);
		}
	});

	return {
		refresh,
		destroy() {
			if (autoRefreshInterval !== undefined) {
				clearInterval(autoRefreshInterval);
			}
			unsubscribeAutoRefresh();
			header.destroy();
			storagePanel.destroy?.();
			mappingPanel.destroy?.();
			container.innerHTML = "";
		},
	};
}

export function mountStubStudioDrawer(
	client: FetchClient,
	options: StubStudioDrawerOptions = {},
): StubStudioController {
	ensureStyle();

	const host = document.createElement("div");
	host.className = "tfs-drawer-host";
	host.classList.add(
		options.position === "bottom-left" ? "tfs-left" : "tfs-right",
	);

	const launcher = document.createElement("button");
	launcher.type = "button";
	launcher.className = "tfs-drawer-launcher";
	launcher.setAttribute("aria-label", options.launcherLabel ?? "Stub Studio");
	launcher.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 32" width="28" height="32" role="img" aria-hidden="true">
  <defs>
    <linearGradient id="tfs-lgi" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#b3e8ff"/>
    </linearGradient>
  </defs>
  <rect x="2" y="22" width="24" height="5" rx="1.5" fill="url(#tfs-lgi)" opacity="0.4"/>
  <rect x="4" y="15" width="20" height="5" rx="1.5" fill="url(#tfs-lgi)" opacity="0.7"/>
  <rect x="6" y="8" width="16" height="5" rx="1.5" fill="url(#tfs-lgi)"/>
  <circle cx="14" cy="5" r="2.5" fill="#b3e8ff"/>
</svg>`;

	const panel = document.createElement("aside");
	panel.className = "tfs-drawer-panel";
	const widthPx = Math.max(320, options.widthPx ?? 700);
	panel.style.width = `${widthPx}px`;

	const mountPoint = document.createElement("div");
	panel.append(mountPoint);

	const studio = mountStubStudio(mountPoint, client, {
		...options,
		className: ["tfs-drawer-studio", options.className ?? ""]
			.filter(Boolean)
			.join(" "),
	});

	const syncLauncherMode = () => {
		const enabled = client.stubManager?.enabled ?? true;
		launcher.classList.toggle("tfs-launcher-on", enabled);
		launcher.classList.toggle("tfs-launcher-off", !enabled);
	};

	syncLauncherMode();
	const unsubscribeLauncherMode = client.stubManager?.subscribeEnabled(() => {
		syncLauncherMode();
	});

	host.append(launcher, panel);
	document.body.append(host);

	let open = options.initiallyOpen ?? false;
	const syncState = () => {
		host.classList.toggle("tfs-open", open);
		launcher.setAttribute("aria-expanded", String(open));
	};

	launcher.addEventListener("click", () => {
		open = !open;
		syncState();
		if (open) {
			studio.refresh();
		}
	});

	syncState();

	return {
		refresh() {
			studio.refresh();
		},
		destroy() {
			unsubscribeLauncherMode?.();
			studio.destroy();
			host.remove();
		},
	};
}

function renderHeader(
	title: string,
	manager: StubManager,
	documentationUrl?: string,
	documentationTarget: "_blank" | "_self" = "_blank",
	advancedModeStore?: AdvancedModeStore,
	autoRefreshStore?: AdvancedModeStore,
	documentationLinks?: Array<{ label: string; url: string; target?: "_blank" | "_self" }>,
): { element: HTMLElement; destroy: () => void } {
	const header = document.createElement("header");
	header.className = "tfs-studio-header";

	const logoWrap = document.createElement("div");
	logoWrap.className = "tfs-studio-logo";
	logoWrap.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 36" width="160" height="36" role="img" aria-label="Fabricate">
  <defs>
    <linearGradient id="tfs-gi" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a74ff"/>
      <stop offset="100%" stop-color="#00d9a4"/>
    </linearGradient>
    <linearGradient id="tfs-gt" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0a74ff"/>
      <stop offset="100%" stop-color="#19b7ff"/>
    </linearGradient>
  </defs>
  <rect x="2" y="22" width="24" height="5" rx="1.5" fill="url(#tfs-gi)" opacity="0.4"/>
  <rect x="4" y="15" width="20" height="5" rx="1.5" fill="url(#tfs-gi)" opacity="0.7"/>
  <rect x="6" y="8" width="16" height="5" rx="1.5" fill="url(#tfs-gi)"/>
  <circle cx="14" cy="5" r="2.5" fill="#00d9a4"/>
  <text x="34" y="26" font-family="'Space Grotesk','Avenir Next','Segoe UI',sans-serif" font-size="18" font-weight="700" letter-spacing="-0.03em" fill="url(#tfs-gt)">Fabricate</text>
</svg>`;

	const badge = document.createElement("span");
	badge.className = "tfs-studio-badge";
	const updateBadge = () => {
		badge.textContent = manager.enabled ? "stub mode on" : "stub mode off";
	};
	updateBadge();

	const row1 = document.createElement("div");
	row1.className = "tfs-header-row1";

	const rightWrap = document.createElement("div");
	rightWrap.className = "tfs-header-right";

	let unsubscribeAdvanced: (() => void) | undefined;
	let unsubscribeAutoRefresh: (() => void) | undefined;

	if (advancedModeStore) {
		const advancedWrap = createToggleSwitch("Advanced user", "tfs-header-toggle");
		rightWrap.append(advancedWrap.root);

		advancedWrap.input.addEventListener("change", () => {
			advancedModeStore.set(advancedWrap.input.checked);
		});

		unsubscribeAdvanced = advancedModeStore.subscribe((advanced) => {
			advancedWrap.input.checked = advanced;
		});
	}

	if (autoRefreshStore) {
		const autoRefreshWrap = createToggleSwitch("Auto refresh", "tfs-header-toggle");
		rightWrap.append(autoRefreshWrap.root);

		autoRefreshWrap.input.addEventListener("change", () => {
			autoRefreshStore.set(autoRefreshWrap.input.checked);
		});

		unsubscribeAutoRefresh = autoRefreshStore.subscribe((enabled) => {
			autoRefreshWrap.input.checked = enabled;
		});
	}

	row1.append(logoWrap, badge);
	header.append(row1);

	const row2 = document.createElement("div");
	row2.className = "tfs-header-row2";

	const modeWrap = createToggleSwitch("Stub mode", "tfs-header-toggle");
	modeWrap.input.checked = manager.enabled;
	modeWrap.input.addEventListener("change", () => {
		manager.setEnabled(modeWrap.input.checked);
	});
	row2.append(modeWrap.root, rightWrap);

	const unsubscribeMode = manager.subscribeEnabled((enabled) => {
		modeWrap.input.checked = enabled;
		updateBadge();
	});

	header.append(row2);

	// Add documentation links on a separate row
	if ((documentationLinks && documentationLinks.length > 0) || documentationUrl) {
		const row3 = document.createElement("div");
		row3.className = "tfs-header-row3";

		if (documentationLinks && documentationLinks.length > 0) {
			documentationLinks.forEach((link) => {
				const linkEl = document.createElement("a");
				linkEl.href = link.url;
				linkEl.target = link.target ?? "_blank";
				linkEl.rel = (link.target ?? "_blank") === "_blank" ? "noopener noreferrer" : "";
				linkEl.className = "tfs-guide-link";
				linkEl.textContent = link.label;
				row3.append(linkEl);
			});
		} else if (documentationUrl) {
			const guideLink = document.createElement("a");
			guideLink.href = documentationUrl;
			guideLink.target = documentationTarget;
			guideLink.rel = documentationTarget === "_blank" ? "noopener noreferrer" : "";
			guideLink.className = "tfs-guide-link";
			guideLink.textContent = "PO/QA guide";
			row3.append(guideLink);
		}

		header.append(row3);
	}

	return {
		element: header,
		destroy() {
			unsubscribeAdvanced?.();
			unsubscribeAutoRefresh?.();
			unsubscribeMode();
		},
	};
}

function renderMessage(title: string, message: string): HTMLElement {
	const wrapper = document.createElement("div");
	wrapper.className = "tfs-studio-empty";

	const h3 = document.createElement("h3");
	h3.textContent = title;

	const p = document.createElement("p");
	p.textContent = message;

	wrapper.append(h3, p);
	return wrapper;
}

function renderStoragePanel(
	manager: StubManager,
	advancedModeStore?: AdvancedModeStore,
): {
	section: HTMLElement;
	refresh: () => void;
	destroy?: () => void;
} {
	const section = document.createElement("section");
	section.className = "tfs-card";

	const header = document.createElement("div");
	header.className = "tfs-card-head";

	const h3 = document.createElement("h3");
	h3.textContent = "Storage";

	const actions = document.createElement("div");
	actions.className = "tfs-actions";

	const refreshButton = createButton("Refresh", "secondary");
	const clearButton = createButton("Clear stub data", "danger");

	actions.append(refreshButton, clearButton);
	header.append(h3, actions);

	const keySelect = document.createElement("select");
	keySelect.className = "tfs-input";

	const manualKeyInput = document.createElement("input");
	manualKeyInput.className = "tfs-input";
	manualKeyInput.placeholder = "Type key without prefix, e.g. resource:/profile";

	const simpleKeyBuilder = document.createElement("div");
	simpleKeyBuilder.className = "tfs-simple-key-builder";

	const keyTypeSelect = document.createElement("select");
	keyTypeSelect.className = "tfs-input";
	for (const t of ["collection", "resource"]) {
		const opt = document.createElement("option");
		opt.value = t;
		opt.textContent = t;
		keyTypeSelect.append(opt);
	}

	const keyPathInput = document.createElement("input");
	keyPathInput.className = "tfs-input";
	keyPathInput.placeholder = "/path  (e.g. /profile)";

	simpleKeyBuilder.append(keyTypeSelect, keyPathInput);

	const simpleBuilder = document.createElement("div");
	simpleBuilder.className = "tfs-simple-builder";

	const rowsContainer = document.createElement("div");
	rowsContainer.className = "tfs-builder-rows";

	const simpleUnsupported = document.createElement("p");
	simpleUnsupported.className = "tfs-helper";
	simpleUnsupported.textContent =
		"Current value is not a JSON object. Enable Advanced user mode (header toggle) for arrays or primitive values.";

	const simpleActions = document.createElement("div");
	simpleActions.className = "tfs-actions";

	const addFieldButton = createButton("+ Add field", "secondary");
	simpleActions.append(addFieldButton);

	simpleBuilder.append(simpleUnsupported, rowsContainer, simpleActions);

	const valueEditor = document.createElement("textarea");
	valueEditor.className = "tfs-textarea";
	valueEditor.rows = 10;
	attachJsonAutoIndent(valueEditor);

	const advancedPanel = document.createElement("div");
	advancedPanel.className = "tfs-advanced-builder";
	advancedPanel.append(attachJsonSyntaxColor(valueEditor));

	const footer = document.createElement("div");
	footer.className = "tfs-actions";

	const saveButton = createButton("Save value", "primary");
	const formatButton = createButton("Format JSON", "secondary");
	const removeButton = createButton("Remove key", "danger");
	const exportButton = createButton("Export snapshot", "secondary");

	footer.append(saveButton, formatButton, removeButton, exportButton);

	section.append(
		header,
		keySelect,
		simpleKeyBuilder,
		manualKeyInput,
		simpleBuilder,
		advancedPanel,
		footer,
	);

	let simpleRows: StorageSimpleRow[] = [];
	let currentValueSupportsForm = true;

	const getActiveKey = (): string => {
		const advanced = advancedModeStore?.get() ?? false;
		if (advanced) {
			const manualKey = manualKeyInput.value.trim();
			if (manualKey) {
				return manualKey.startsWith("fabricate:") ? manualKey : `fabricate:${manualKey}`;
			}
		} else {
			const path = keyPathInput.value.trim();
			if (path) {
				return `fabricate:${keyTypeSelect.value}:${path}`;
			}
		}
		return keySelect.value.trim();
	};

	const renderSimpleRows = () => {
		rowsContainer.innerHTML = "";

		if (!currentValueSupportsForm) {
			simpleUnsupported.style.display = "block";
			return;
		}

		simpleUnsupported.style.display = "none";

		if (simpleRows.length === 0) {
			const empty = document.createElement("p");
			empty.className = "tfs-helper";
			empty.textContent = "No fields yet. Click + Add field.";
			rowsContainer.append(empty);
			return;
		}

		simpleRows.forEach((row, index) => {
			const rowEl = document.createElement("div");
			rowEl.className = "tfs-builder-item";

			const pathInput = document.createElement("input");
			pathInput.className = "tfs-input";
			pathInput.placeholder = "field path (example: profile.firstName)";
			pathInput.value = row.path;

			const typeSelect = document.createElement("select");
			typeSelect.className = "tfs-input";

			const types: Array<StorageSimpleValueType> = ["string", "number", "boolean", "null"];
			for (const type of types) {
				const option = document.createElement("option");
				option.value = type;
				option.textContent = type;
				typeSelect.append(option);
			}
			typeSelect.value = row.type;

			const valueInput = document.createElement("input");
			valueInput.className = "tfs-input";
			valueInput.placeholder =
				row.type === "boolean"
					? "true or false"
					: row.type === "number"
						? "number value"
						: row.type === "null"
							? "(ignored for null)"
							: "string value";
			valueInput.value = row.value;
			valueInput.disabled = row.type === "null";

			const removeButton = createButton("Remove", "danger");
			removeButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none"><path stroke="currentColor" stroke-width="2" d="M4 4l8 8M12 4l-8 8"/></svg>';

			pathInput.addEventListener("input", () => {
				const current = simpleRows[index];
				if (!current) {
					return;
				}

				simpleRows[index] = {
					...current,
					path: pathInput.value.trim(),
				};
			});

			typeSelect.addEventListener("change", () => {
				const current = simpleRows[index];
				if (!current) {
					return;
				}

				const nextType = typeSelect.value as StorageSimpleValueType;
				simpleRows[index] = {
					...current,
					type: nextType,
					value: nextType === "null" ? "" : current.value,
				};
				renderSimpleRows();
			});

			valueInput.addEventListener("input", () => {
				const current = simpleRows[index];
				if (!current) {
					return;
				}

				simpleRows[index] = {
					...current,
					value: valueInput.value,
				};
			});

			removeButton.addEventListener("click", () => {
				simpleRows = simpleRows.filter((_, idx) => idx !== index);
				renderSimpleRows();
			});

			rowEl.append(pathInput, typeSelect, valueInput, removeButton);
			rowsContainer.append(rowEl);
		});
	};

	const toggleMode = () => {
		const advanced = advancedModeStore?.get() ?? false;
		simpleKeyBuilder.style.display = advanced ? "none" : "flex";
		manualKeyInput.style.display = advanced ? "block" : "none";
		simpleBuilder.style.display = advanced ? "none" : "block";
		advancedPanel.style.display = advanced ? "block" : "none";
		addFieldButton.disabled = !currentValueSupportsForm;
	};

	const renderValue = () => {
		const key = getActiveKey();
		if (!key) {
			setJsonEditorValue(valueEditor, "");
			simpleRows = [];
			currentValueSupportsForm = true;
			renderSimpleRows();
			toggleMode();
			return;
		}

		const value = manager.getStorageValue(key);

		if (value === null) {
			setJsonEditorValue(valueEditor, "{}");
			simpleRows = [];
			currentValueSupportsForm = true;
			renderSimpleRows();
			toggleMode();
			return;
		}

		setJsonEditorValue(valueEditor, JSON.stringify(value, null, 2));

		if (isObject(value)) {
			simpleRows = flattenStorageSimpleRows(value);
			currentValueSupportsForm = true;
		} else {
			simpleRows = [];
			currentValueSupportsForm = false;
		}

		renderSimpleRows();
		toggleMode();
	};

	const refresh = () => {
		const keys = manager.listStorageKeys();
		const current = keySelect.value;

		keySelect.innerHTML = "";

		const placeholder = document.createElement("option");
		placeholder.value = "";
		placeholder.textContent = keys.length > 0 ? "Select a key" : "No data";
		keySelect.append(placeholder);

		for (const key of keys) {
			const option = document.createElement("option");
			option.value = key;
			option.textContent = key.replace(/^fabricate:/, "");
			keySelect.append(option);
		}

		if (current && keys.includes(current)) {
			keySelect.value = current;
		}

		renderValue();
	};

	keySelect.addEventListener("change", () => {
		if (keySelect.value) {
			manualKeyInput.value = "";
			keyPathInput.value = "";
		}
		renderValue();
	});

	manualKeyInput.addEventListener("input", () => {
		if (manualKeyInput.value.trim()) {
			keySelect.value = "";
		}
		renderValue();
	});

	keyPathInput.addEventListener("input", () => {
		if (keyPathInput.value.trim()) {
			keySelect.value = "";
			manualKeyInput.value = "";
		}
		renderValue();
	});

	keyTypeSelect.addEventListener("change", () => {
		if (keyPathInput.value.trim()) {
			renderValue();
		}
	});

	refreshButton.addEventListener("click", refresh);
	clearButton.addEventListener("click", () => {
		manager.clearStorage();
		refresh();
	});

	addFieldButton.addEventListener("click", () => {
		simpleRows = [...simpleRows, { path: "", type: "string", value: "" }];
		renderSimpleRows();
	});

	saveButton.addEventListener("click", () => {
		const key = getActiveKey();
		if (!key) {
			return;
		}

		if ((advancedModeStore?.get() ?? false) || !currentValueSupportsForm) {
			manager.setStorageValue(key, parseEditor(valueEditor));
		} else {
			manager.setStorageValue(key, buildStorageSimpleValue(simpleRows));
		}

		manualKeyInput.value = "";
		keyPathInput.value = "";
		refresh();
	});

	removeButton.addEventListener("click", () => {
		const key = getActiveKey();
		if (!key) {
			return;
		}

		manager.removeStorageKey(key);
		manualKeyInput.value = "";
		keyPathInput.value = "";
		refresh();
	});

	exportButton.addEventListener("click", () => {
		const snapshot = JSON.stringify(manager.exportStorageSnapshot(), null, 2);
		const blob = new Blob([snapshot], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = `fabricate-snapshot-${new Date().getTime()}.json`;
		link.click();
		URL.revokeObjectURL(url);
	});

	formatButton.addEventListener("click", () => {
		setJsonEditorValue(valueEditor, formatJson(valueEditor.value));
	});

	const unsubscribeAdvanced = advancedModeStore?.subscribe(() => {
		toggleMode();
	});

	toggleMode();

	return {
		section,
		refresh,
		destroy() {
			unsubscribeAdvanced?.();
		},
	};
}

function renderMappingPanel(
	manager: StubManager,
	advancedModeStore?: AdvancedModeStore,
): {
	section: HTMLElement;
	refresh: () => void;
	destroy?: () => void;
} {
	const section = document.createElement("section");
	section.className = "tfs-card";

	const header = document.createElement("div");
	header.className = "tfs-card-head";

	const h3 = document.createElement("h3");
	h3.textContent = "Extra Mapping Generated Field";

	const actions = document.createElement("div");
	actions.className = "tfs-actions";

	header.append(h3, actions);

	const helper = document.createElement("p");
	helper.className = "tfs-helper";
	helper.textContent = "Use simple mode for PO/QA-friendly rules.";

	let isFunctionMapping = false;

	const simpleBuilder = document.createElement("div");
	simpleBuilder.className = "tfs-simple-builder";

	const routeRow = document.createElement("div");
	routeRow.className = "tfs-builder-row";

	const routeInput = document.createElement("input");
	routeInput.className = "tfs-input";
	routeInput.placeholder = "/users";

	const addFieldButton = createButton("+ Add field", "secondary");
	const removeRouteButton = createButton("Remove route", "danger");
	removeRouteButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none"><path stroke="currentColor" stroke-width="2" d="M4 4l8 8M12 4l-8 8"/></svg>';

	routeRow.append(routeInput, addFieldButton, removeRouteButton);

	const rowsContainer = document.createElement("div");
	rowsContainer.className = "tfs-builder-rows";

	const simpleActions = document.createElement("div");
	simpleActions.className = "tfs-actions tfs-mapping-simple-actions";

	const applySimpleButton = createButton("Add mapping", "primary");
	const resetSimpleButton = createButton("Reset all mappings", "danger");

	simpleActions.append(applySimpleButton, resetSimpleButton);
	simpleBuilder.append(routeRow, rowsContainer, simpleActions);

	const editor = document.createElement("textarea");
	editor.className = "tfs-textarea";
	editor.rows = 14;
	attachJsonAutoIndent(editor);

	const advancedPanel = document.createElement("div");
	advancedPanel.className = "tfs-advanced-builder";

	const footer = document.createElement("div");
	footer.className = "tfs-actions tfs-mapping-advanced-actions";

	const applyButton = createButton("Apply mapping", "primary");
	const resetButton = createButton("Reset mapping", "danger");

	footer.append(applyButton, resetButton);

	advancedPanel.append(attachJsonSyntaxColor(editor), footer);

	section.append(header, helper, simpleBuilder, advancedPanel);

	let simpleRows: SimpleMappingRow[] = [];

	const renderSimpleRows = () => {
		rowsContainer.innerHTML = "";

		if (simpleRows.length === 0) {
			const empty = document.createElement("p");
			empty.className = "tfs-helper";
			empty.textContent = "No fields yet. Click + Add field.";
			rowsContainer.append(empty);
			return;
		}

		simpleRows.forEach((row, index) => {
			const rowEl = document.createElement("div");
			rowEl.className = "tfs-builder-item";

			const fieldInput = document.createElement("input");
			fieldInput.className = "tfs-input";
			fieldInput.placeholder = "field path (example: profile.firstName)";
			fieldInput.value = row.path;

			const typeSelect = document.createElement("select");
			typeSelect.className = "tfs-input";

			const types: Array<SimpleRuleType> = [
				"number.int",
				"person.fullName",
				"person.firstName",
				"person.lastName",
				"string.word",
				"string.uuid",
				"pick",
				"date.recent",
				"date.between",
				"literal.string",
				"literal.number",
				"literal.boolean",
			];

			for (const type of types) {
				const option = document.createElement("option");
				option.value = type;
				option.textContent = type;
				typeSelect.append(option);
			}

			typeSelect.value = row.type;

			const optionsInput = document.createElement("input");
			optionsInput.className = "tfs-input";
			optionsInput.placeholder = describeSimpleType(row.type);
			optionsInput.value = row.options;

			const removeButton = createButton("Remove", "danger");
			removeButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none"><path stroke="currentColor" stroke-width="2" d="M4 4l8 8M12 4l-8 8"/></svg>';

			fieldInput.addEventListener("input", () => {
				const current = simpleRows[index];
				if (!current) {
					return;
				}

				simpleRows[index] = {
					...current,
					path: fieldInput.value.trim(),
				};
			});

			typeSelect.addEventListener("change", () => {
				const current = simpleRows[index];
				if (!current) {
					return;
				}

				simpleRows[index] = {
					...current,
					type: typeSelect.value as SimpleRuleType,
				};
				optionsInput.placeholder = describeSimpleType(
					(simpleRows[index] as SimpleMappingRow).type,
				);
			});

			optionsInput.addEventListener("input", () => {
				const current = simpleRows[index];
				if (!current) {
					return;
				}

				simpleRows[index] = {
					...current,
					options: optionsInput.value,
				};
			});

			removeButton.addEventListener("click", () => {
				simpleRows = simpleRows.filter((_, idx) => idx !== index);
				renderSimpleRows();
			});

			rowEl.append(fieldInput, typeSelect, optionsInput, removeButton);
			rowsContainer.append(rowEl);
		});
	};

	const toggleMode = () => {
		const advanced = isFunctionMapping || (advancedModeStore?.get() ?? false);
		simpleBuilder.style.display = advanced ? "none" : "block";
		advancedPanel.style.display = advanced ? "block" : "none";
	};

	const refresh = () => {
		const mapping = manager.getPostGeneratedFieldsJson();

		if (typeof mapping === "function") {
			editor.readOnly = true;
			setJsonEditorValue(
				editor,
				"// runtime mapping is provided by a function and cannot be edited as JSON",
			);
			isFunctionMapping = true;
			routeInput.value = "";
			simpleRows = [];
			renderSimpleRows();
			toggleMode();
			return;
		}

		isFunctionMapping = false;
		editor.readOnly = false;
		setJsonEditorValue(editor, JSON.stringify(mapping ?? {}, null, 2));

		const routes = Object.keys(mapping ?? {});
		const selectedRoute = routeInput.value.trim() || routes[0] || "/users";
		routeInput.value = selectedRoute;
		simpleRows = flattenSimpleRows(
			(mapping?.[selectedRoute] as Record<string, unknown> | undefined) ?? {},
		);
		renderSimpleRows();
		toggleMode();
	};

	addFieldButton.addEventListener("click", () => {
		simpleRows = [...simpleRows, { path: "", type: "number.int", options: "18,30,true" }];
		renderSimpleRows();
	});

	routeInput.addEventListener("change", () => {
		const mapping = manager.getPostGeneratedFieldsJson();
		if (!mapping || typeof mapping === "function") {
			simpleRows = [];
			renderSimpleRows();
			return;
		}

		const route = routeInput.value.trim();
		simpleRows = flattenSimpleRows(
			(mapping[route] as Record<string, unknown> | undefined) ?? {},
		);
		renderSimpleRows();
	});

	removeRouteButton.addEventListener("click", () => {
		const mapping = manager.getPostGeneratedFieldsJson();
		if (!mapping || typeof mapping === "function") {
			return;
		}

		const route = routeInput.value.trim();
		if (!route) {
			return;
		}

		const next = { ...mapping } as Record<string, unknown>;
		delete next[route];
		manager.setPostGeneratedFieldsJson(next as StubPostGeneratedFieldsJsonInput);
		refresh();
	});

	applySimpleButton.addEventListener("click", () => {
		const route = routeInput.value.trim();
		if (!route) {
			return;
		}

		const current = manager.getPostGeneratedFieldsJson();
		if (typeof current === "function") {
			return;
		}

		const next = {
			...(current ?? {}),
			[route]: buildSimpleRouteConfig(simpleRows),
		};

		manager.setPostGeneratedFieldsJson(next as StubPostGeneratedFieldsJsonInput);
		refresh();
	});

	resetSimpleButton.addEventListener("click", () => {
		manager.setPostGeneratedFieldsJson(undefined);
		refresh();
	});

	applyButton.addEventListener("click", () => {
		if (editor.readOnly) {
			return;
		}

		manager.setPostGeneratedFieldsJson(
			parseRecordEditor(editor) as StubPostGeneratedFieldsJsonInput,
		);
	});

	resetButton.addEventListener("click", () => {
		manager.setPostGeneratedFieldsJson(undefined);
		refresh();
	});

	const unsubscribeAdvanced = advancedModeStore?.subscribe(() => {
		if (!isFunctionMapping) {
			toggleMode();
		}
	});

	toggleMode();

	return {
		section,
		refresh,
		destroy() {
			unsubscribeAdvanced?.();
		},
	};
}

type StorageSimpleValueType = "string" | "number" | "boolean" | "null";

type StorageSimpleRow = {
	path: string;
	type: StorageSimpleValueType;
	value: string;
};

type SimpleRuleType =
	| "number.int"
	| "person.fullName"
	| "person.firstName"
	| "person.lastName"
	| "string.word"
	| "string.uuid"
	| "pick"
	| "date.recent"
	| "date.between"
	| "literal.string"
	| "literal.number"
	| "literal.boolean";

type SimpleMappingRow = {
	path: string;
	type: SimpleRuleType;
	options: string;
};

function flattenStorageSimpleRows(
	value: Record<string, unknown>,
	prefix = "",
): StorageSimpleRow[] {
	const rows: StorageSimpleRow[] = [];

	for (const [key, entry] of Object.entries(value)) {
		const path = prefix ? `${prefix}.${key}` : key;

		if (isObject(entry)) {
			rows.push(...flattenStorageSimpleRows(entry, path));
			continue;
		}

		if (typeof entry === "number") {
			rows.push({ path, type: "number", value: String(entry) });
			continue;
		}

		if (typeof entry === "boolean") {
			rows.push({ path, type: "boolean", value: String(entry) });
			continue;
		}

		if (entry === null) {
			rows.push({ path, type: "null", value: "" });
			continue;
		}

		rows.push({ path, type: "string", value: String(entry) });
	}

	return rows;
}

function buildStorageSimpleValue(rows: StorageSimpleRow[]): Record<string, unknown> {
	const result: Record<string, unknown> = {};

	for (const row of rows) {
		const path = row.path.trim();
		if (!path) {
			continue;
		}

		setDeepValue(result, path, storageSimpleRowToValue(row));
	}

	return result;
}

function storageSimpleRowToValue(row: StorageSimpleRow): unknown {
	switch (row.type) {
		case "number": {
			const parsed = Number(row.value.trim());
			return Number.isFinite(parsed) ? parsed : 0;
		}
		case "boolean":
			return row.value.trim().toLowerCase() === "true";
		case "null":
			return null;
		default:
			return row.value;
	}
}

function describeSimpleType(type: SimpleRuleType): string {
	switch (type) {
		case "number.int":
			return "min,max,asString (example: 18,30,true)";
		case "pick":
			return "comma-separated values (example: car,peter,house)";
		case "date.recent":
			return "days (example: 7)";
		case "date.between":
			return "from,to ISO dates";
		case "literal.number":
			return "number value";
		case "literal.boolean":
			return "true or false";
		case "literal.string":
			return "string value";
		default:
			return "no extra option needed";
	}
}

function flattenSimpleRows(
	routeConfig: Record<string, unknown>,
	prefix = "",
): SimpleMappingRow[] {
	const rows: SimpleMappingRow[] = [];

	for (const [key, value] of Object.entries(routeConfig)) {
		const path = prefix ? `${prefix}.${key}` : key;
		if (isObject(value) && typeof (value as { type?: unknown }).type === "string") {
			rows.push(ruleToSimpleRow(path, value as Record<string, unknown>));
			continue;
		}

		if (isObject(value)) {
			rows.push(...flattenSimpleRows(value as Record<string, unknown>, path));
			continue;
		}

		rows.push({
			path,
			type: inferLiteralType(value),
			options: String(value),
		});
	}

	return rows;
}

function inferLiteralType(value: unknown): SimpleRuleType {
	if (typeof value === "number") {
		return "literal.number";
	}

	if (typeof value === "boolean") {
		return "literal.boolean";
	}

	return "literal.string";
}

function ruleToSimpleRow(path: string, value: Record<string, unknown>): SimpleMappingRow {
	const type = value.type as SimpleRuleType;

	switch (type) {
		case "number.int":
			return {
				path,
				type,
				options: `${value.min ?? ""},${value.max ?? ""},${value.asString ?? false}`,
			};
		case "pick":
			return {
				path,
				type,
				options: Array.isArray(value.values) ? value.values.join(",") : "",
			};
		case "date.recent":
			return {
				path,
				type,
				options: `${value.days ?? "7"}`,
			};
		case "date.between":
			return {
				path,
				type,
				options: `${value.from ?? ""},${value.to ?? ""}`,
			};
		default:
			return {
				path,
				type,
				options: "",
			};
	}
}

function buildSimpleRouteConfig(rows: SimpleMappingRow[]): Record<string, unknown> {
	const result: Record<string, unknown> = {};

	for (const row of rows) {
		const path = row.path.trim();
		if (!path) {
			continue;
		}

		setDeepValue(result, path, simpleRowToValue(row));
	}

	return result;
}

function simpleRowToValue(row: SimpleMappingRow): unknown {
	const parts = row.options.split(",").map((part) => part.trim());

	switch (row.type) {
		case "number.int": {
			const [minRaw, maxRaw, asStringRaw] = parts;
			const payload: Record<string, unknown> = {
				type: "number.int",
			};

			if (minRaw) {
				payload.min = Number(minRaw);
			}

			if (maxRaw) {
				payload.max = Number(maxRaw);
			}

			if (asStringRaw) {
				payload.asString = asStringRaw === "true";
			}

			return payload;
		}
		case "pick":
			return {
				type: "pick",
				values: parts.filter(Boolean),
			};
		case "date.recent": {
			const [daysRaw] = parts;
			return {
				type: "date.recent",
				days: daysRaw ? Number(daysRaw) : 7,
			};
		}
		case "date.between": {
			const [from, to] = parts;
			return {
				type: "date.between",
				from,
				to,
			};
		}
		case "literal.number":
			return Number(parts[0] ?? "0");
		case "literal.boolean":
			return (parts[0] ?? "false") === "true";
		case "literal.string":
			return parts.join(",");
		default:
			return {
				type: row.type,
			};
	}
}

function setDeepValue(target: Record<string, unknown>, path: string, value: unknown): void {
	const chunks = path.split(".").map((chunk) => chunk.trim()).filter(Boolean);
	if (chunks.length === 0) {
		return;
	}

	let pointer: Record<string, unknown> = target;

	for (let index = 0; index < chunks.length - 1; index += 1) {
		const key = chunks[index];
		if (!key) {
			return;
		}

		const existing = pointer[key];

		if (!isObject(existing)) {
			pointer[key] = {};
		}

		pointer = pointer[key] as Record<string, unknown>;
	}

	const finalKey = chunks[chunks.length - 1];
	if (!finalKey) {
		return;
	}

	pointer[finalKey] = value;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return Object.prototype.toString.call(value) === "[object Object]";
}

function renderScenariosPanel(
	manager: StubManager,
	refreshAll: () => void,
): {
	section: HTMLElement;
	refresh: () => void;
} {
	const section = document.createElement("section");
	section.className = "tfs-card";

	const header = document.createElement("div");
	header.className = "tfs-card-head";

	const h3 = document.createElement("h3");
	h3.textContent = "Scenario presets";

	header.append(h3);

	const helper = document.createElement("p");
	helper.className = "tfs-helper";
	helper.textContent =
		"Quick recipes for PO/QA validation without backend availability.";

	const actions = document.createElement("div");
	actions.className = "tfs-actions";

	const presets = manager.getScenarioPresets();
	const presetNames = Object.keys(presets);

	if (presetNames.length === 0) {
		section.append(header, helper);
		const emptyMessage = document.createElement("p");
		emptyMessage.className = "tfs-helper";
		emptyMessage.textContent = "No scenario presets configured.";
		section.append(emptyMessage);
		return {
			section,
			refresh() {
				return;
			},
		};
	}

	for (const presetName of presetNames) {
		const preset = presets[presetName];
		if (!preset) {
			continue;
		}
		const button = createButton(preset.label, "secondary");
		button.title = preset.description ?? "";
		button.addEventListener("click", () => {
			preset.execute(manager);
			refreshAll();
		});
		actions.append(button);
	}

	section.append(header, helper, actions);

	return {
		section,
		refresh() {
			return;
		},
	};
}

function createButton(label: string, variant: "primary" | "secondary" | "danger"): HTMLButtonElement {
	const button = document.createElement("button");
	button.type = "button";
	button.className = `tfs-button tfs-${variant}`;
	button.textContent = label;
	return button;
}

function createToggleSwitch(
	label: string,
	extraClass?: string,
): { root: HTMLElement; input: HTMLInputElement } {
	const wrap = document.createElement("label");
	wrap.className = ["tfs-toggle", extraClass ?? ""].filter(Boolean).join(" ");

	const input = document.createElement("input");
	input.type = "checkbox";

	const track = document.createElement("span");
	track.className = "tfs-toggle-track";

	const thumb = document.createElement("span");
	thumb.className = "tfs-toggle-thumb";

	track.append(thumb);

	const text = document.createElement("span");
	text.textContent = label;

	wrap.append(input, track, text);

	return { root: wrap, input };
}

function formatJson(text: string): string {
	try {
		return JSON.stringify(JSON.parse(text), null, 2);
	} catch {
		return text;
	}
}

function setJsonEditorValue(editor: HTMLTextAreaElement, value: string): void {
	editor.value = value;
	editor.dispatchEvent(new Event("input"));
}

function attachJsonSyntaxColor(editor: HTMLTextAreaElement): HTMLElement {
	const shell = document.createElement("div");
	shell.className = "tfs-code-editor-shell";

	const wrapper = document.createElement("div");
	wrapper.className = "tfs-code-editor";

	const highlight = document.createElement("pre");
	highlight.className = "tfs-code-highlight";
	highlight.setAttribute("aria-hidden", "true");

	const error = document.createElement("p");
	error.className = "tfs-json-error";
	error.setAttribute("aria-live", "polite");

	editor.classList.add("tfs-code-editor-input");
	editor.spellcheck = false;

	const sync = () => {
		highlight.innerHTML = highlightJsonHtml(editor.value);
		highlight.scrollTop = editor.scrollTop;
		highlight.scrollLeft = editor.scrollLeft;

		const text = editor.value.trim();
		const shouldValidate = !editor.readOnly && text.length > 0;
		let isInvalid = false;
		let errorMessage = "";
		if (shouldValidate) {
			try {
				JSON.parse(editor.value);
			} catch (parseError) {
				isInvalid = true;
				errorMessage =
					parseError instanceof Error
						? `Invalid JSON: ${parseError.message}`
						: "Invalid JSON.";
			}
		}

		wrapper.classList.toggle("tfs-json-invalid", isInvalid);
		shell.classList.toggle("tfs-json-has-error", Boolean(errorMessage));
		error.textContent = errorMessage;
	};

	editor.addEventListener("input", sync);
	editor.addEventListener("scroll", () => {
		highlight.scrollTop = editor.scrollTop;
		highlight.scrollLeft = editor.scrollLeft;
	});

	sync();
	wrapper.append(highlight, editor);
	shell.append(wrapper, error);
	return shell;
}

function highlightJsonHtml(text: string): string {
	const tokenRegex =
		/"(?:\\.|[^"\\])*"(?=\s*:)|"(?:\\.|[^"\\])*"|\b-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?\b|\btrue\b|\bfalse\b|\bnull\b|[{}\[\],:]/g;

	let html = "";
	let lastIndex = 0;

	for (const match of text.matchAll(tokenRegex)) {
		const token = match[0];
		const index = match.index ?? 0;
		const afterToken = text.slice(index + token.length);

		html += escapeHtml(text.slice(lastIndex, index));

		const className = token.startsWith("\"")
			? /^\s*:/.test(afterToken)
				? "tfs-json-key"
				: "tfs-json-string"
			: token === "true" || token === "false"
				? "tfs-json-boolean"
				: token === "null"
					? "tfs-json-null"
					: token === "{" ||
						  token === "}" ||
						  token === "[" ||
						  token === "]" ||
						  token === "," ||
						  token === ":"
							? "tfs-json-punct"
							: "tfs-json-number";

		html += `<span class="${className}">${escapeHtml(token)}</span>`;
		lastIndex = index + token.length;
	}

	html += escapeHtml(text.slice(lastIndex));
	return html || "\n";
}

function escapeHtml(text: string): string {
	return text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}

function attachJsonAutoIndent(editor: HTMLTextAreaElement): void {
	editor.addEventListener("keydown", (event) => {
		if (event.key === "{" || event.key === "[") {
			event.preventDefault();

			const open = event.key;
			const close = open === "{" ? "}" : "]";
			const value = editor.value;
			const start = editor.selectionStart;
			const end = editor.selectionEnd;
			const before = value.slice(0, start);
			const selected = value.slice(start, end);
			const after = value.slice(end);
			const lineStart = value.lastIndexOf("\n", start - 1) + 1;
			const currentLine = value.slice(lineStart, start);
			const currentIndent = (currentLine.match(/^\s*/) ?? [""])[0];

			let insert = "";
			let nextCaret = start;

			if (selected.length > 0) {
				insert = `${open}${selected}${close}`;
				nextCaret = start + insert.length;
			} else {
				const prevTrimmed = before.trimEnd();
				const prevChar = prevTrimmed.slice(-1);
				const useMultiline =
					prevTrimmed.length === 0 ||
					prevChar === ":" ||
					prevChar === "{" ||
					prevChar === "[" ||
					prevChar === ",";

				if (useMultiline) {
					const nestedIndent = `${currentIndent}  `;
					insert = `${open}\n${nestedIndent}\n${currentIndent}${close}`;
					nextCaret = start + open.length + 1 + nestedIndent.length;
				} else {
					insert = `${open}${close}`;
					nextCaret = start + 1;
				}
			}

			editor.value = before + insert + after;
			editor.selectionStart = nextCaret;
			editor.selectionEnd = nextCaret;
			editor.dispatchEvent(new Event("input"));
			return;
		}

		if (event.key !== "Enter") {
			return;
		}

		event.preventDefault();

		const value = editor.value;
		const start = editor.selectionStart;
		const end = editor.selectionEnd;
		const lineStart = value.lastIndexOf("\n", start - 1) + 1;
		const currentLine = value.slice(lineStart, start);
		const currentIndent = (currentLine.match(/^\s*/) ?? [""])[0];

		const before = value.slice(0, start);
		const after = value.slice(end);
		const prevChar = before.trimEnd().slice(-1);
		const nextChar = after.trimStart().slice(0, 1);
		const closesBlock = nextChar === "}" || nextChar === "]";
		const opensBlock = prevChar === "{" || prevChar === "[";

		let insert = `\n${currentIndent}`;
		let nextCaret = start + insert.length;

		if (opensBlock) {
			const nestedIndent = `${currentIndent}  `;
			if (closesBlock) {
				insert = `\n${nestedIndent}\n${currentIndent}`;
				nextCaret = start + 1 + nestedIndent.length;
			} else {
				insert = `\n${nestedIndent}`;
				nextCaret = start + insert.length;
			}
		}

		editor.value = before + insert + after;
		editor.selectionStart = nextCaret;
		editor.selectionEnd = nextCaret;
		editor.dispatchEvent(new Event("input"));
	});
}

function parseEditor(editor: HTMLTextAreaElement): unknown {
	try {
		return JSON.parse(editor.value);
	} catch (error) {
		throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
	}
}

function parseRecordEditor(editor: HTMLTextAreaElement): Record<string, unknown> {
	const parsed = parseEditor(editor);

	if (Object.prototype.toString.call(parsed) !== "[object Object]") {
		throw new Error("Expected a JSON object.");
	}

	return parsed as Record<string, unknown>;
}

function ensureStyle(): void {
	if (document.getElementById(STYLE_ID)) {
		return;
	}

	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.textContent = `
.tfs-studio-host {
	font-family: "Space Grotesk", "Avenir Next", "Segoe UI", sans-serif;
}
.tfs-drawer-host {
	position: fixed;
	bottom: 20px;
	z-index: 9998;
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	gap: 10px;
	pointer-events: none;
}
.tfs-drawer-host.tfs-left {
	left: 20px;
	align-items: flex-start;
}
.tfs-drawer-host.tfs-right {
	right: 20px;
}
.tfs-drawer-launcher {
	pointer-events: auto;
	border: 0;
	border-radius: 999px;
	padding: 10px 12px;
	background: linear-gradient(120deg, #003ad9, #00c2ff);
	color: #fff;
	display: flex;
	align-items: center;
	justify-content: center;
	box-shadow: 0 12px 24px rgba(0, 62, 126, 0.36);
	cursor: pointer;
	transition: transform 140ms ease, filter 140ms ease;
}
.tfs-drawer-launcher.tfs-launcher-on {
	background: linear-gradient(120deg, #003ad9, #00c2ff);
}
.tfs-drawer-launcher.tfs-launcher-off {
	background: linear-gradient(120deg, #b32020, #ff5a5a);
}
.tfs-drawer-launcher:hover {
	transform: translateY(-1px) scale(1.01);
	filter: brightness(1.04);
}
.tfs-drawer-panel {
	pointer-events: auto;
	max-height: min(78vh, 860px);
	overflow: auto;
	opacity: 0;
	transform: translateY(16px) scale(0.98);
	transform-origin: bottom right;
	transition: opacity 180ms ease, transform 220ms ease;
	visibility: hidden;
}
.tfs-drawer-host.tfs-left .tfs-drawer-panel {
	transform-origin: bottom left;
}
.tfs-drawer-host.tfs-open .tfs-drawer-panel {
	opacity: 1;
	transform: translateY(0) scale(1);
	visibility: visible;
}
.tfs-drawer-studio {
	margin: 0;
}
.tfs-studio {
	position: relative;
	overflow: hidden;
	border-radius: 20px;
	border: 1px solid rgba(255, 255, 255, 0.3);
	background: linear-gradient(135deg, #f4f7ff 0%, #e5fff8 50%, #fff4ea 100%);
	box-shadow: 0 20px 50px rgba(13, 31, 66, 0.2);
	padding: 20px;
}
.tfs-studio::before,
.tfs-studio::after {
	content: "";
	position: absolute;
	width: 260px;
	height: 260px;
	border-radius: 50%;
	filter: blur(28px);
	opacity: 0.35;
	pointer-events: none;
}
.tfs-studio::before {
	background: #36c5f0;
	top: -120px;
	right: -40px;
	animation: tfsFloatA 12s ease-in-out infinite;
}
.tfs-studio::after {
	background: #ff8f4d;
	bottom: -140px;
	left: -40px;
	animation: tfsFloatB 14s ease-in-out infinite;
}
.tfs-studio-header {
	position: relative;
	z-index: 1;
	display: flex;
	flex-direction: column;
	gap: 8px;
	margin-bottom: 16px;
}
.tfs-header-row1 {
	display: flex;
	align-items: center;
	gap: 8px;
}
.tfs-header-row2 {
	display: flex;
	align-items: center;
	justify-content: flex-start;
	gap: 10px;
	flex-wrap: wrap;
}
.tfs-header-row3 {
	display: flex;
	align-items: center;
	justify-content: flex-start;
	gap: 10px;
	flex-wrap: wrap;
}
.tfs-header-right {
	display: flex;
	align-items: center;
	gap: 10px;
	flex-shrink: 0;
}
.tfs-header-row2 .tfs-toggle,
.tfs-header-right .tfs-toggle {
	margin: 0;
	min-height: 38px;
	display: inline-flex;
	align-items: center;
}
.tfs-studio-title {
	display: none;
}
.tfs-studio-header h2 {
	margin: 0;
	font-size: 1.5rem;
	letter-spacing: -0.02em;
	color: #112340;
}
.tfs-guide-link {
	text-decoration: none;
	border-radius: 999px;
	padding: 6px 11px;
	min-height: 38px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	font-size: 0.78rem;
	font-weight: 700;
	letter-spacing: 0.05em;
	flex-shrink: 0;
	white-space: nowrap;
	text-transform: uppercase;
	color: #11315f;
	background: linear-gradient(120deg, rgba(255, 255, 255, 0.88), rgba(229, 243, 255, 0.95));
	border: 1px solid rgba(17, 49, 95, 0.15);
	transition: transform 120ms ease, filter 120ms ease;
}
.tfs-header-toggle {
	padding: 5px 9px;
	border-radius: 999px;
	background: rgba(255, 255, 255, 0.78);
	border: 1px solid rgba(17, 49, 95, 0.15);
	flex-shrink: 0;
	white-space: nowrap;
}
.tfs-guide-link:hover {
	transform: translateY(-1px);
	filter: brightness(1.03);
}
.tfs-studio-badge {
	display: inline-flex;
	align-items: center;
	margin-left: auto;
	padding: 4px 9px;
	border-radius: 999px;
	background: rgba(17, 35, 64, 0.08);
	color: #112340;
	font-size: 0.70rem;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.06em;
	white-space: nowrap;
}
.tfs-studio-logo {
	display: flex;
	align-items: center;
	flex-shrink: 0;
}
.tfs-studio-content {
	position: relative;
	z-index: 1;
	display: grid;
	gap: 14px;
}
.tfs-card {
	padding: 18px;
	border-radius: 14px;
	background: rgba(255, 255, 255, 0.72);
	border: 1px solid rgba(12, 31, 58, 0.12);
	backdrop-filter: blur(6px);
	animation: tfsSlideUp 420ms ease both;
	display: flex;
	flex-direction: column;
	gap: 10px;
}
.tfs-card-head {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 10px;
}
.tfs-card h3 {
	margin: 0;
	color: #132749;
}
.tfs-helper {
	margin: 4px 0;
	font-size: 0.88rem;
	color: #29436a;
}
.tfs-toggle {
	display: inline-flex;
	align-items: center;
	gap: 10px;
	margin: 6px 0 12px;
	font-size: 0.84rem;
	font-weight: 600;
	color: #20395f;
	cursor: pointer;
	user-select: none;
}
.tfs-toggle-track {
	position: relative;
	width: 40px;
	height: 22px;
	border-radius: 999px;
	background: rgba(19, 39, 73, 0.15);
	transition: background 200ms ease;
	flex-shrink: 0;
}
.tfs-toggle input {
	position: absolute;
	opacity: 0;
	width: 0;
	height: 0;
	pointer-events: none;
}
.tfs-toggle input:checked ~ .tfs-toggle-track {
	background: linear-gradient(120deg, #0a74ff, #19b7ff);
}
.tfs-toggle-thumb {
	position: absolute;
	top: 3px;
	left: 3px;
	width: 16px;
	height: 16px;
	border-radius: 50%;
	background: #fff;
	box-shadow: 0 1px 4px rgba(0,0,0,0.22);
	transition: transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
.tfs-toggle input:checked ~ .tfs-toggle-track .tfs-toggle-thumb {
	transform: translateX(18px);
}
.tfs-simple-key-builder {
	display: flex;
	gap: 6px;
	align-items: center;
	min-width: 0;
	width: 100%;
	box-sizing: border-box;
	overflow: hidden;
}
.tfs-simple-key-builder select {
	flex: 0 0 auto;
	min-width: 110px;
	max-width: 130px;
}
.tfs-simple-key-builder input {
	flex: 1 1 0;
	min-width: 0;
}
.tfs-simple-builder,
.tfs-advanced-builder {
	animation: tfsSlideUp 220ms ease both;
}
.tfs-builder-row {
	display: grid;
	grid-template-columns: 1fr auto auto;
	gap: 8px;
}
.tfs-builder-rows {
	display: grid;
	gap: 6px;
	margin-top: 6px;
}
.tfs-builder-item {
	display: grid;
	grid-template-columns: 1.2fr 0.8fr 1fr auto;
	gap: 8px;
}
.tfs-builder-rows .tfs-builder-item:last-child {
	margin-bottom: 8px;
}
.tfs-actions {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	margin: 0;
}
.tfs-mapping-simple-actions {
	margin-top: 10px;
}
.tfs-mapping-advanced-actions {
	margin-top: 10px;
}
.tfs-input,
.tfs-textarea {
	width: 100%;
	box-sizing: border-box;
	border-radius: 10px;
	border: 1px solid rgba(29, 52, 81, 0.18);
	background: rgba(255, 255, 255, 0.92);
	color: #10233f;
	padding: 10px 12px;
	font-size: 0.92rem;
}
.tfs-textarea {
	font-family: "JetBrains Mono", "SFMono-Regular", Menlo, monospace;
	line-height: 1.45;
	resize: vertical;
}
.tfs-code-editor {
	position: relative;
	width: 100%;
}
.tfs-code-editor-shell {
	width: 100%;
}
.tfs-code-highlight {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	margin: 0;
	padding: 10px 12px;
	font-family: "JetBrains Mono", "SFMono-Regular", Menlo, monospace;
	font-size: 0.92rem;
	line-height: 1.45;
	white-space: pre;
	overflow: hidden;
	pointer-events: none;
	user-select: none;
	box-sizing: border-box;
	border-radius: 10px;
	background: rgba(255, 255, 255, 0.96);
	color: #10233f;
}
.tfs-code-editor-input {
	position: relative;
	background: transparent;
	color: transparent;
	caret-color: #10233f;
	border-color: rgba(29, 52, 81, 0.18);
	z-index: 1;
}
.tfs-code-editor.tfs-json-invalid .tfs-code-editor-input {
	border-color: rgba(191, 56, 56, 0.65);
	box-shadow: inset 0 0 0 1px rgba(191, 56, 56, 0.35);
}
.tfs-code-editor.tfs-json-invalid .tfs-code-highlight {
	background: rgba(255, 243, 243, 0.98);
}
.tfs-json-error {
	position: static;
	margin: 8px 4px 0;
	padding: 4px 8px;
	border-radius: 8px;
	border: 1px solid rgba(175, 34, 34, 0.28);
	background: rgba(255, 245, 245, 0.96);
	font-size: 0.78rem;
	line-height: 1.35;
	color: #8f1f1f;
	font-weight: 600;
	display: none;
}
.tfs-code-editor-shell.tfs-json-has-error .tfs-json-error {
	display: block;
}
.tfs-json-key {
	color: #084da7;
}
.tfs-json-string {
	color: #0f6e57;
}
.tfs-json-number {
	color: #7c3f00;
}
.tfs-json-boolean {
	color: #7f1d1d;
}
.tfs-json-null {
	color: #6d4a19;
}
.tfs-json-punct {
	color: #243c62;
}
.tfs-button {
	border: 0;
	border-radius: 10px;
	padding: 8px 12px;
	font-size: 0.82rem;
	font-weight: 600;
	letter-spacing: 0.02em;
	cursor: pointer;
	transition: transform 120ms ease, filter 120ms ease;
}
.tfs-button:hover {
	transform: translateY(-1px);
	filter: brightness(1.03);
}
.tfs-primary {
	background: linear-gradient(120deg, #0a74ff, #19b7ff);
	color: white;
}
.tfs-secondary {
	background: linear-gradient(120deg, #eef4ff, #dff4ff);
	color: #0f2e57;
}
.tfs-danger {
	background: linear-gradient(120deg, #ffe2dd, #ffd2c8);
	color: #7a1e0f;
}
.tfs-empty {
	padding: 18px;
	border-radius: 16px;
	background: rgba(255, 255, 255, 0.75);
}
@keyframes tfsPulse {
	0%, 100% { transform: scale(1); }
	50% { transform: scale(1.1); }
}
@keyframes tfsSlideUp {
	from { transform: translateY(8px); opacity: 0; }
	to { transform: translateY(0); opacity: 1; }
}
@keyframes tfsFloatA {
	0%, 100% { transform: translateY(0px) translateX(0px); }
	50% { transform: translateY(10px) translateX(-12px); }
}
@keyframes tfsFloatB {
	0%, 100% { transform: translateY(0px) translateX(0px); }
	50% { transform: translateY(-12px) translateX(14px); }
}
@media (max-width: 720px) {
	.tfs-drawer-host,
	.tfs-drawer-host.tfs-left,
	.tfs-drawer-host.tfs-right {
		left: 10px;
		right: 10px;
		align-items: stretch;
	}
	.tfs-drawer-panel {
		width: 100% !important;
	}
	.tfs-builder-row,
	.tfs-builder-item {
		grid-template-columns: 1fr;
	}
	.tfs-studio { padding: 14px; border-radius: 14px; }
	.tfs-card { padding: 12px; }
	.tfs-actions {
		flex-wrap: wrap;
	}
}

@media (max-width: 480px) {
	.tfs-drawer-panel {
		max-height: 85vh;
	}
	.tfs-studio {
		padding: 10px;
	}
	.tfs-card {
		padding: 10px;
		gap: 8px;
	}
	.tfs-input,
	.tfs-textarea {
		padding: 8px 10px;
		font-size: 0.85rem;
	}
	.tfs-actions button {
		flex: 1 1 calc(50% - 4px);
	}
	.tfs-simple-key-builder {
		flex-direction: column;
	}
	.tfs-simple-key-builder select,
	.tfs-simple-key-builder input {
		width: 100%;
	}
}
`;

	document.head.append(style);
}
