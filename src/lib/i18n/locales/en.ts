export const en = {
  common: {
    productName: 'Home Center',
    productShortName: 'Home Center',
    productSubtitle: 'Commercial console',
    phaseBaseline: 'Phase 0 application baseline',
    cancel: 'Cancel',
    common: {
      cancel: 'Cancel',
    },
    actions: {
      connect: 'Connect',
      manageConnection: 'Connection',
    },
    language: {
      switch: 'Language',
      simplifiedChinese: 'Simplified Chinese',
      traditionalChinese: 'Traditional Chinese',
      english: 'English',
      russian: 'Russian',
    },
    theme: {
      switch: 'Switch theme',
      mode: 'Mode',
      light: 'Light',
      dark: 'Dark',
      system: 'System',
    },
    navigation: {
      dashboard: 'Dashboard',
      providers: 'Model services',
      credentials: 'Account credentials',
      accessKeys: 'Access keys',
      config: 'System config',
      usageLogs: 'Usage & Logs',
      systemNodes: 'System Info',
    },
    navigationGroups: {
      operate: 'Operate',
      gateway: 'Gateway',
      observe: 'Observe',
      control: 'Control',
    },
    navigationMeta: {
      dashboard: 'Runtime overview',
      providers: 'Model service config',
      credentials: 'Global credential pool',
      accessKeys: 'Client access control',
      config: 'Gateway core settings',
      usageLogs: 'Spend and traces',
      systemNodes: 'Runtime and diagnostics',
    },
    sidebar: {
      controlPlane: 'AI Gateway Management Console',
      collapse: 'Collapse sidebar',
      expand: 'Expand sidebar',
      openMobile: 'Open navigation',
      closeMobile: 'Close navigation',
      connectionStatus: {
        connected: 'Connected',
        disconnected: 'Not connected',
        error: 'Connection failed',
        checking: 'Checking…',
        hint: 'Use the page prompt to configure the endpoint and management key',
        errorHint: 'Check the management endpoint and management key',
        runtime: 'Mode',
        endpoint: 'Endpoint',
        connectedAction: 'Manage {{mode}} connection',
        disconnectedAction: 'Open connection management',
        errorAction: 'Review connection settings',
      },
    },
    commandPalette: {
      label: 'Global command palette',
      description: 'Search console pages and available actions.',
      trigger: 'Search commands',
      shortcut: '⌘K',
      placeholder: 'Search pages or actions',
      empty: 'No matching commands found.',
      groups: {
        session: 'Connection',
      },
      commands: {
        manageConnection: {
          title: 'Connection management',
          connected: 'Review or update the current Management API connection',
          disconnected: 'Connect a started Management API runtime',
          keywords: 'runtime endpoint management key',
        },
        disconnect: {
          title: 'Disconnect',
          description: 'Clear the current Management API session',
          keywords: 'sign out clear session',
        },
      },
    },
    runtimeMode: {
      cpa: 'CPA',
      'home-standalone': 'Home standalone',
      'home-cluster': 'Home cluster',
      unknown: 'Unknown runtime',
    },
    connectionDialog: {
      title: 'Connect to started server',
      description:
        'Enter the gateway endpoint and management key to activate full management capabilities.',
      cancel: 'Cancel',
      close: 'Close connection dialog',
      baseUrl: 'Management endpoint',
      baseUrlHint:
        'You can enter the service origin or /v0/management endpoint. The console normalizes it automatically.',
      detectedRuntime: 'Local runtime detected: {{endpoint}}',
      managementKey: 'Management key',
      managementKeyPlaceholder: 'Paste management key',
      remember: 'Remember this connection',
      rememberHint:
        'Keeps the endpoint and key in this browser. Leave unchecked to keep them only for this tab session.',
      connect: 'Connect',
      connecting: 'Connecting',
      disconnect: 'Disconnect',
      connectedAs: 'Connected to {{mode}}.',
      errors: {
        managementKeyRequired: 'Management key is required.',
      },
    },
    dashboard: {
      disconnected: {
        title: 'Connect a management runtime',
        description:
          'Connect the Home Center management API to view server status, model services, account credentials, client keys, and node information.',
        detectedRuntime:
          'A local Management API was found. Enter the management key to finish connecting: {{endpoint}}',
        action: 'Connect runtime',
      },
      error: {
        title: 'Dashboard data could not be loaded',
        description: 'Check the management endpoint, management key, and runtime availability.',
        retry: 'Retry',
      },
      health: {
        ready: {
          title: 'Service is ready for model requests',
          description:
            'Model services, account credentials, and client access keys are available. Continue with usage, logs, or configuration checks.',
        },
        needsModelService: {
          title: 'Configure a model service first',
          description:
            'No available model keys were returned, so the gateway may not be able to serve model requests. Add at least one model service key.',
        },
        needsCredential: {
          title: 'Account credentials need attention',
          description:
            'Model services are connected, but no available account credentials were returned. OAuth or file-backed channels may not work.',
        },
        needsClientKey: {
          title: 'Create a client access key',
          description:
            'The server has model access information, but no client key is available for callers to use the server API.',
        },
        limited: {
          title: 'Service is connected with limited capabilities',
          description:
            'Core data loaded, but this runtime does not expose every observability route. Model, credential, and config management remain available.',
        },
        degraded: {
          title: 'Service is connected with items to review',
          description:
            'Core data loaded, but request failures, Debug mode, or routing configuration need review. Start with the suggested actions below.',
        },
      },
      header: {
        eyebrow: 'Home overview',
        title: 'Server runtime overview',
        description:
          'Check whether the connected gateway server is running, which model services are configured, and whether client keys and account credentials are available.',
        refresh: 'Sync data',
        syncing: 'Syncing',
        runtime: 'Connected server: {{mode}}',
        version: 'Latest available version: {{version}}',
        updatedAt: 'Last synced: {{time}}',
      },
      recommendedActions: {
        title: 'Suggested actions',
        configureProviders: 'Configure model service',
        addCredential: 'Add account credential',
        createClientKey: 'Create client key',
        checkRouting: 'Check routing config',
        reviewDebug: 'Review Debug mode',
        reviewDataStatus: 'Review data status',
      },
      status: {
        unknown: 'Unknown',
        enabled: 'Enabled',
        disabled: 'Disabled',
        available: 'Available',
        unavailable: 'Unavailable',
        notAvailableShort: 'N/A',
      },
      metrics: {
        providers: {
          title: 'Available model keys',
          detail: '{{count}} model service types connected',
        },
        credentials: {
          title: 'Available account credentials',
          detail: '{{count}} credential records found',
        },
        clientKeys: {
          title: 'Client access keys',
          detail: '{{count}} keys can call the server API',
        },
        nodes: {
          title: 'Runtime nodes',
          detail: '{{count}} nodes reported by the current service',
        },
      },
      quickActions: {
        title: 'Shortcuts',
        description: 'Open common management pages.',
        providers: {
          title: 'Model services',
          description: 'Review model service keys and disabled entries.',
        },
        credentials: {
          title: 'Account credentials',
          description: 'Check OAuth and file-backed account state.',
        },
        accessKeys: {
          title: 'Key management',
          description: 'Manage keys used by clients to call the server API.',
        },
        config: {
          title: 'System config',
          description: 'Adjust routing, logging, and YAML settings.',
        },
        systemNodes: {
          title: 'System Info',
          description: 'Review versions, connection status, nodes, and diagnostics.',
        },
      },
      providers: {
        title: 'Model service access',
        description: 'Review total, available, and disabled keys for each model service type.',
        emptyTitle: 'No model services configured',
        emptyDescription:
          'No model service keys were returned. Add a model service before the gateway can forward requests upstream.',
        configureAction: 'Configure model service',
        total: 'Total',
        active: 'Available',
        disabled: 'Disabled',
      },
      providerNames: {
        gemini: 'Gemini',
        claude: 'Claude',
        codex: 'Codex',
        vertex: 'Vertex',
        openaiCompatibility: 'OpenAI',
        ampcode: 'Amp CLI Integration (ampcode)',
      },
      config: {
        title: 'Key switches',
        description: 'Settings that affect logging, usage tracking, and request routing.',
      },
      configChecks: {
        requestLog: 'Request log',
        usageStatistics: 'Usage statistics',
        fileLogging: 'File logging',
        debug: 'Debug mode',
        routing: 'Routing strategy',
      },
      capabilities: {
        title: 'Available features',
        description: 'Management features supported by the connected service.',
      },
      capabilityNames: {
        nodes: 'Node management',
        usage: 'Usage statistics',
        usageQueue: 'Usage queue',
        logs: 'Request logs',
        requestErrorLogs: 'Error logs',
      },
      credentials: {
        title: 'Account credential sources',
        description:
          'Account records grouped by how they are stored, including OAuth login and credential files.',
        empty: 'No account credential records were returned.',
      },
      credentialSourceNames: {
        file: 'File',
        memory: 'Memory',
        db: 'Database',
        unknown: 'Unknown source',
      },
      issues: {
        title: 'Data loading status',
        description: 'Shows whether dashboard data and runtime capabilities are fully available.',
        empty: 'Dashboard data loaded completely.',
        requestFailed: 'Request failed: {{status}}',
        unavailableCapability: 'Not provided by this runtime',
      },
      issueScopes: {
        latestVersion: 'Latest version',
        clientKeys: 'Client keys',
        authFiles: 'Auth files',
        nodes: 'Nodes',
        gemini: 'Gemini',
        claude: 'Claude',
        codex: 'Codex',
        vertex: 'Vertex',
        openaiCompatibility: 'OpenAI',
        ampcode: 'Amp CLI Integration (ampcode)',
      },
    },
    providersPage: {
      disconnected: {
        title: 'Connect a management runtime',
        description:
          'Model keys are loaded from the Management API. Connect a runtime before reviewing or editing model service keys.',
        action: 'Connect runtime',
      },
      error: {
        title: 'Model provider data could not be loaded',
        description: 'Check the management endpoint, key, and model provider routes.',
        retry: 'Retry',
      },
      header: {
        eyebrow: 'Model provider workbench',
        title: 'Model Providers',
        description:
          'Manage model service keys through normalized standalone and cluster identifiers without changing the backend API contract.',
        activeResources: '{{active}} active of {{total}} model keys',
        providerFamilies: '{{count}} model provider types configured',
        updatedAt: 'Last synced: {{time}}',
        issueCount: '{{count}} partial issues',
      },
      actions: {
        refresh: 'Sync data',
        syncing: 'Syncing',
        new: 'New model key',
        create: 'Create',
        save: 'Save changes',
        cancel: 'Cancel',
        view: 'View',
        edit: 'Edit',
        delete: 'Delete',
      },
      categories: {
        title: 'Model Providers',
        activeCount: '{{active}} / {{total}} active',
      },
      providerNames: {
        gemini: 'Gemini',
        claude: 'Claude',
        codex: 'Codex',
        vertex: 'Vertex',
        openaiCompatibility: 'OpenAI',
      },
      table: {
        description: 'Route: {{route}}',
        filterPlaceholder: 'Filter model keys',
        empty: 'No model keys match the current model provider and filter.',
        providerIssue: 'This model provider route returned an issue',
        key: 'Key / identity',
        baseUrl: 'Base URL',
        prefix: 'Prefix',
        models: 'Models',
        status: 'Status',
        actions: 'Actions',
        modelSummary: '{{models}} models · {{headers}} headers',
      },
      modelCatalog: {
        title: 'Available models reference',
        description:
          'Read-only model definitions related to {{provider}}. Changing the reference channel only updates this panel. It does not change the model provider or model keys managed above.',
        standaloneDescription:
          'Read-only model definitions for the {{channel}} reference channel. Changing the reference channel only updates this panel. It does not change the model provider or model keys managed above.',
        summaryTitle: 'Available models reference',
        summaryCount: '{{count}} models',
        summaryError: 'Load failed',
        loading: 'Loading',
        openAction: 'View models',
        retry: 'Retry',
        channelLabel: 'Reference channel',
        filterPlaceholder: 'Filter models',
        updatedAt: 'Updated {{time}}',
        notLoaded: 'Not loaded',
        empty: 'No model definitions match the current channel and filter.',
        errorTitle: 'Model catalog could not be loaded',
        contextLength: 'Context {{value}}',
        maxCompletionTokens: 'Output {{value}}',
        modalities: 'Input {{value}}',
        thinking: 'Thinking {{value}}',
        channels: {
          gemini: 'Gemini',
          claude: 'Claude',
          codex: 'Codex',
          vertex: 'Vertex',
          'gemini-cli': 'Gemini CLI',
          aistudio: 'AI Studio',
          kimi: 'Kimi',
          antigravity: 'Antigravity',
        },
      },
      status: {
        active: 'Active',
        disabled: 'Disabled',
        none: 'None',
        notSet: 'Not set',
        notAvailable: 'N/A',
      },
      detail: {
        title: 'Model key detail',
        empty: 'Select a model key or create a new entry.',
        metadataTitle: 'More metadata',
        fields: {
          identifier: 'Identifier',
          authIndex: 'Auth index',
          baseUrl: 'Base URL',
          proxyUrl: 'Proxy URL',
          prefix: 'Prefix',
          models: 'Models',
          headers: 'Headers',
          excludedModels: 'Excluded models',
          apiKeyEntries: 'API key entries',
        },
      },
      form: {
        createEyebrow: 'New model key',
        editEyebrow: 'Edit model key',
        name: 'Model provider name',
        apiKey: 'Model service key',
        apiKeyCreatePlaceholder: 'Paste model service key',
        apiKeyEditPlaceholder: 'Leave blank to keep the current key',
        baseUrl: 'Base URL',
        baseUrlRequiredHint:
          'Codex and OpenAI-compatible providers require a Base URL. The backend ignores entries with an empty Base URL.',
        proxyUrl: 'Proxy URL',
        prefix: 'Model prefix',
        disabled: 'Disabled',
        disabledHint: 'Only OpenAI-compatible model provider entries expose this field.',
        validation: {
          nameRequired: 'Enter a model provider name before saving.',
          apiKeyRequired: 'Enter a model service key before saving.',
          baseUrlRequired:
            'Enter a Base URL before saving. Codex and OpenAI-compatible providers cannot use an empty Base URL.',
        },
      },
      delete: {
        title: 'Delete model key?',
        confirm: 'Delete model key "{{name}}"?',
      },
      toast: {
        created: 'Model key created.',
        updated: 'Model key updated.',
        deleted: 'Model key deleted.',
      },
    },
    credentialsPage: {
      disconnected: {
        title: 'Connect a management runtime',
        description:
          'Credentials are loaded from the Management API. Connect a runtime before reviewing OAuth and file-backed resources.',
        action: 'Connect runtime',
      },
      error: {
        title: 'Credential data could not be loaded',
        description: 'Check the management endpoint, key, and auth-files route.',
        retry: 'Retry',
      },
      header: {
        eyebrow: 'Credential workbench',
        title: 'OAuth and file-backed credentials',
        description:
          'Manage runtime credentials as resources: inspect source, status, account metadata, model provider type, and operational actions.',
        activeResources: '{{active}} active of {{total}} credentials',
        disabledCount: '{{count}} disabled',
        unavailableCount: '{{count}} unavailable',
        updatedAt: 'Last synced: {{time}}',
      },
      actions: {
        refresh: 'Sync data',
        syncing: 'Syncing',
        addCredential: 'Add credential',
        upload: 'Upload JSON',
        save: 'Save metadata',
        view: 'View',
        edit: 'Edit',
        loadModels: 'Load models',
        viewModels: 'View models',
        reloadModels: 'Reload',
        enable: 'Enable',
        disable: 'Disable',
        returnToDetail: 'Back to detail',
        download: 'Download',
        delete: 'Delete',
      },
      filters: {
        status: 'Status',
        source: 'Source',
        provider: 'Model provider',
        allSources: 'All sources',
        allProviders: 'All model providers',
      },
      statusFilters: {
        all: 'All credentials',
        active: 'Active',
        disabled: 'Disabled',
        unavailable: 'Unavailable',
      },
      create: {
        title: 'Add account credential',
        description:
          'Choose login, upload, or import. New credentials appear in the resource list after creation.',
        modes: {
          oauth: 'OAuth login',
          upload: 'Upload JSON',
          vertex: 'Vertex import',
        },
      },
      oauth: {
        title: 'OAuth login',
        startLogin: 'Start login',
        showAdvanced: 'Show advanced options',
        hideAdvanced: 'Hide advanced options',
        closureTitle: 'Authorization status and callback',
        closureDescription:
          'Login has started. Check the authorization status here, or submit the callback URL if the browser redirect was not captured automatically.',
        lastProvider: 'Last provider',
        lastState: 'State',
        statusState: 'Authorization status token',
        statePlaceholder: 'OAuth state',
        statusNotChecked: 'Authorization status has not been checked.',
        checkStatus: 'Check status',
        callbackProvider: 'Model provider',
        callbackState: 'Callback status token',
        redirectUrl: 'Full callback URL',
        authorizationCode: 'Authorization code',
        callbackError: 'Error message',
        submitCallback: 'Submit callback URL',
        geminiProjectLabel: 'Gemini Project ID',
        geminiProjectPlaceholder: 'Project ID, optional',
        geminiProjectHint:
          'Leave blank to let the runtime choose the first available project. Enter ALL to fetch all projects.',
        callbackUnsupported:
          'This login method is completed by runtime status polling and does not require a manual callback URL.',
        providerHints: {
          claude: 'Create an account credential through Claude OAuth.',
          codex: 'Create an account credential through Codex OAuth.',
          gemini: 'Create a Google account credential through Gemini CLI OAuth.',
          antigravity: 'Create a Google account credential through Antigravity OAuth.',
          kimi: 'Create an account credential through Kimi device flow.',
        },
        statuses: {
          ok: 'Completed',
          wait: 'Waiting',
          error: 'Failed',
          unknown: 'Unknown',
        },
        validation: {
          stateRequired: 'Enter the OAuth state.',
          callbackPayloadRequired: 'Enter a callback URL, authorization code, or error message.',
        },
        providers: {
          claude: 'Claude',
          codex: 'Codex',
          gemini: 'Gemini CLI',
          antigravity: 'Antigravity',
          kimi: 'Kimi',
        },
      },
      vertex: {
        title: 'Vertex credential import',
        description:
          'Upload a Vertex service account JSON file and create a Gemini/Vertex credential.',
        file: 'Service account JSON',
        location: 'Vertex location',
        import: 'Import Vertex credential',
        fields: {
          status: 'Status',
          projectId: 'Project ID',
          email: 'Service account',
          location: 'Location',
          authFile: 'Auth file',
        },
        validation: {
          fileRequired: 'Choose a service account JSON file to import.',
        },
      },
      upload: {
        title: 'Upload credential JSON',
        description:
          'Upload existing OAuth or file-backed credential JSON files. Multiple files are supported.',
        chooseFiles: 'Choose JSON files',
        actionHint: 'Click or drop JSON files here.',
      },
      list: {
        title: 'Credential resources',
        description: 'Manage account credentials created by OAuth login or file import.',
        filterPlaceholder: 'Filter credentials',
        empty: 'No credentials match the current filters.',
        credential: 'Credential / account',
        provider: 'Model provider',
        source: 'Source',
        type: 'Type',
        status: 'Status',
        updatedAt: 'Updated',
        actions: 'Actions',
      },
      sourceNames: {
        file: 'File',
        memory: 'Memory',
        db: 'Database',
        unknown: 'Unknown source',
      },
      status: {
        active: 'Active',
        disabled: 'Disabled',
        unavailable: 'Unavailable',
        notSet: 'Not set',
        notAvailable: 'N/A',
      },
      detail: {
        title: 'Credential detail',
        empty: 'Select a credential to inspect metadata and actions.',
        noModels: 'No models were returned for this credential.',
        modelsTitle: 'Available models',
        modelsDescription: 'Query the runtime for models available to this credential.',
        modelCount: '{{count}} models loaded.',
        statusActionTitle: 'Credential status',
        enableDescription:
          'This credential is disabled. Enable it to let it participate in model requests again.',
        disableDescription:
          'Disable this credential to remove it from model requests. You can re-enable it later.',
        fields: {
          provider: 'Model provider',
          type: 'Type',
          source: 'Source',
          account: 'Account',
          authIndex: 'Auth index',
          path: 'Path',
          size: 'Size',
          priority: 'Priority',
          success: 'Success',
          failed: 'Failed',
          updatedAt: 'Updated',
          lastRefresh: 'Last refresh',
          note: 'Note',
        },
      },
      form: {
        eyebrow: 'Edit metadata',
        contextTitle: 'Current credential',
        editableHint:
          'Only Prefix, Proxy URL, priority, and note are editable here. Account, source, and model provider come from the runtime credential record.',
        context: {
          provider: 'Model provider',
          source: 'Source',
          account: 'Account',
          identifier: 'Identifier',
        },
        prefix: 'Prefix',
        proxyUrl: 'Proxy URL',
        priority: 'Priority',
        note: 'Note',
      },
      delete: {
        title: 'Delete credential?',
        confirm: 'Delete credential "{{name}}"?',
      },
      toast: {
        uploaded: 'Credential file uploaded.',
        downloaded: 'Credential downloaded.',
        updated: 'Credential metadata updated.',
        deleted: 'Credential deleted.',
        statusUpdated: 'Credential status updated.',
        oauthStarted: 'OAuth login opened.',
        oauthStatusChecked: 'OAuth status: {{status}}.',
        oauthCallbackSubmitted: 'OAuth callback submitted.',
        vertexImported: 'Vertex credential imported.',
      },
    },
    accessKeysPage: {
      disconnected: {
        title: 'Connect a management runtime',
        description:
          'Client access keys are loaded from the Management API. Connect a runtime before managing client access keys.',
        action: 'Connect runtime',
      },
      error: {
        title: 'Access keys could not be loaded',
        description: 'Check the management endpoint, key, and /api-keys route.',
        retry: 'Retry',
      },
      header: {
        eyebrow: 'Client access control',
        title: 'Client access keys',
        description:
          'Manage the keys that clients use to call the server API. These are separate from model service keys.',
        total: '{{count}} keys configured',
        accepted: 'Accepted by proxy runtime',
        updatedAt: 'Last synced: {{time}}',
      },
      actions: {
        refresh: 'Sync data',
        syncing: 'Syncing',
        new: 'New access key',
        create: 'Create key',
        save: 'Save key',
        view: 'View',
        edit: 'Edit',
        delete: 'Delete',
        copy: 'Copy',
        reveal: 'Reveal',
        hide: 'Hide',
        generate: 'Generate key',
        replace: 'Replace all',
      },
      list: {
        title: 'Access keys',
        description: 'Keys returned by GET /api-keys. Server-side metadata is not assumed.',
        filterPlaceholder: 'Filter keys',
        empty: 'No access keys match the current filter.',
        index: 'No.',
        key: 'Key',
        length: 'Length',
        status: 'Status',
        actions: 'Actions',
        prefixSuffix: '{{prefix}}…{{suffix}}',
      },
      status: {
        accepted: 'Accepted',
      },
      bulk: {
        selectAll: 'Select all keys in the current list',
        selectOne: 'Select access key {{key}}',
        selected: '{{count}} keys selected',
        clearSelection: 'Clear selection',
        deleteSelected: 'Delete selected',
        deleteTitle: 'Delete selected access keys?',
        deleteConfirm: 'Delete {{count}} selected access keys?',
      },
      detail: {
        title: 'Key detail',
        empty: 'Select a key or create a new one.',
        secret: 'Secret value',
        fields: {
          prefix: 'Prefix',
          suffix: 'Suffix',
          length: 'Length',
        },
      },
      form: {
        createEyebrow: 'Create access key',
        editEyebrow: 'Edit access key',
        createTitle: 'New downstream key',
        editTitle: 'Update downstream key',
        keyValue: 'Key value',
        validation: {
          required: 'Key value is required.',
        },
      },
      replace: {
        eyebrow: 'Full replacement',
        title: 'Replace all access keys',
        description:
          'This uses PUT /api-keys and replaces the entire downstream key list. Enter one key per line.',
        warning:
          'Submitting this will overwrite all current client access keys with the entered list. Confirm the list is complete first.',
        textarea: 'Keys',
        confirm:
          'Replace all access keys with the entered list? The current list will be overwritten.',
      },
      delete: {
        title: 'Delete access key?',
        confirm: 'Delete access key {{key}}?',
      },
      toast: {
        copied: 'Access key copied.',
        created: 'Access key created.',
        updated: 'Access key updated.',
        replaced: 'Access key list replaced.',
        deleted: 'Access key deleted.',
        bulkDeleted: '{{count}} access keys deleted.',
      },
    },
    configPage: {
      disconnected: {
        title: 'Connect a management runtime',
        description:
          'System configuration is loaded from the Management API. Connect a runtime before reading, editing, and saving config.',
        action: 'Connect runtime',
      },
      error: {
        title: 'System config could not be loaded',
        description: 'Check the management endpoint, management key, and config routes.',
        retry: 'Retry',
      },
      header: {
        title: 'Configuration workspace',
        description:
          'Use visual mode for safe common edits. Use config file mode for full config.yaml replacement.',
        runtime: 'Runtime: {{mode}}',
        updatedAt: 'Updated {{time}}',
      },
      modes: {
        label: 'Config editing mode',
        structured: 'Visual',
        yaml: 'Config file',
      },
      actions: {
        reload: 'Reload',
        save: 'Save',
        viewChanges: 'View changes',
        showSensitive: 'Show sensitive field',
        hideSensitive: 'Hide sensitive field',
      },
      status: {
        clean: 'No unsaved changes',
        unsaved: 'Unsaved changes',
        visualChangeCount: '{{count}} visual changes',
        fileChanged: 'Config file changed',
        enabled: 'Enabled',
        disabled: 'Disabled',
        emptyValue: 'empty',
      },
      outline: {
        title: 'Config outline',
      },
      sections: {
        server: {
          title: 'Server runtime',
          shortTitle: 'Server',
          description: 'Core switches that affect runtime diagnostics and service behavior.',
        },
        tls: {
          title: 'TLS',
          shortTitle: 'TLS',
          description:
            'Configure HTTPS, certificate path, and private key path. Saving writes back to config.yaml.',
        },
        remoteManagement: {
          title: 'Remote management',
          shortTitle: 'Management',
          description:
            'Control remote Management API access, the management key, and control panel update behavior.',
        },
        authentication: {
          title: 'Authentication',
          shortTitle: 'Auth',
          description: 'Control client authentication behavior such as WebSocket auth.',
        },
        oauthRules: {
          title: 'OAuth model rules',
          shortTitle: 'OAuth rules',
          description:
            'Configure excluded models and client-visible aliases for OAuth and file-backed credentials.',
        },
        system: {
          title: 'Logs and usage',
          shortTitle: 'Logs',
          description: 'Control request logs, file logs, usage statistics, and log retention.',
        },
        network: {
          title: 'Network proxy',
          shortTitle: 'Network',
          description: 'Configure the outbound proxy used by the server.',
        },
        quota: {
          title: 'Quota handling',
          shortTitle: 'Quota',
          description: 'Control fallback behavior when quota is exhausted.',
        },
        streaming: {
          title: 'Retry and routing',
          shortTitle: 'Routing',
          description: 'Control request retry timing and model service routing.',
        },
        ampcode: {
          title: 'Amp CLI integration',
          shortTitle: 'Amp',
          description: 'Configure Amp CLI upstream endpoints, key mappings, and model mappings.',
        },
        payload: {
          title: 'Payload rules',
          shortTitle: 'Payload',
          description:
            'Control model prefix handling. Maintain full payload rules in config file mode.',
        },
      },
      fields: {
        debug: {
          label: 'Debug mode',
          description: 'Outputs more runtime diagnostics. Use carefully in production.',
        },
        loggingToFile: {
          label: 'File logging',
          description: 'Write logs to files for longer-term troubleshooting.',
        },
        logsMaxTotalSizeMb: {
          label: 'Max log size MB',
          description: 'Limit total log file size. 0 lets the server default policy handle it.',
        },
        errorLogsMaxFiles: {
          label: 'Error log files',
          description: 'Limit the number of retained error log files.',
        },
        usageStatisticsEnabled: {
          label: 'Usage statistics',
          description: 'Record usage data by client key and request.',
        },
        tlsEnable: {
          label: 'Enable HTTPS',
          description: 'Serve external traffic over HTTPS with the configured TLS certificate.',
        },
        tlsCert: {
          label: 'Certificate path',
          description: 'TLS certificate file path, mapped to tls.cert in config.yaml.',
          placeholder: '/path/to/cert.pem',
        },
        tlsKey: {
          label: 'Private key path',
          description: 'TLS private key file path, mapped to tls.key in config.yaml.',
          placeholder: '/path/to/key.pem',
        },
        remoteManagementAllowRemote: {
          label: 'Allow remote management',
          description: 'Allow non-localhost clients to access the Management API.',
        },
        remoteManagementSecretKey: {
          label: 'Management key',
          description:
            'Key used by the management panel. In local config mode, the server processes plaintext keys at startup.',
          placeholder: 'Enter management key',
        },
        remoteManagementDisableControlPanel: {
          label: 'Disable control panel',
          description: 'Disable /management.html and panel syncing.',
        },
        remoteManagementDisableAutoUpdatePanel: {
          label: 'Disable panel auto update',
          description: 'Disable periodic background updates for panel assets.',
        },
        remoteManagementPanelGithubRepository: {
          label: 'Panel repository URL',
          description: 'GitHub repository URL or releases API URL used for panel asset updates.',
          placeholder: 'https://github.com/org/repo',
        },
        proxyUrl: {
          label: 'Outbound proxy URL',
          description: 'Proxy URL used by the server for outbound requests. Empty removes it.',
          placeholder: 'http://127.0.0.1:7890',
        },
        requestLog: {
          label: 'Request log',
          description: 'Record request-level logs for troubleshooting.',
        },
        wsAuth: {
          label: 'WebSocket auth',
          description: 'Require authentication for WebSocket connections.',
        },
        requestRetry: {
          label: 'Request retries',
          description: 'Number of retries after request failures.',
        },
        maxRetryInterval: {
          label: 'Max retry interval',
          description: 'Upper bound for retry wait time.',
        },
        forceModelPrefix: {
          label: 'Force model prefix',
          description: 'Force model prefix rules when processing requested model names.',
        },
        routingStrategy: {
          label: 'Routing strategy',
          description: 'Selection strategy when multiple keys or credentials are available.',
        },
        quotaSwitchProject: {
          label: 'Switch project on quota',
          description: 'Try another available project when project quota is exhausted.',
        },
        quotaSwitchPreviewModel: {
          label: 'Switch preview model on quota',
          description: 'Try an available preview model when quota is exhausted.',
        },
        ampcodeUpstreamUrl: {
          label: 'Amp upstream URL',
          description: 'Upstream service URL for Amp CLI requests. Empty removes the setting.',
          placeholder: 'https://amp.example.com',
        },
        ampcodeUpstreamApiKey: {
          label: 'Amp upstream key',
          description: 'Single upstream Amp API key. Empty removes the setting.',
          placeholder: 'Paste Amp upstream key',
        },
        ampcodeRestrictManagementToLocalhost: {
          label: 'Localhost-only management',
          description: 'Restrict AmpCode management access to localhost.',
        },
        ampcodeForceModelMappings: {
          label: 'Force model mappings',
          description: 'Force the model mappings below when enabled.',
        },
        ampcodeModelMappingsJson: {
          label: 'Model mappings',
          description:
            'Map requested Amp models to upstream target models, with optional regex matching.',
          placeholder: '[{"from":"claude-opus-4.5","to":"claude-sonnet-4","regex":false}]',
        },
        ampcodeUpstreamApiKeysJson: {
          label: 'Multiple upstream keys',
          description:
            'Map client keys to specific Amp upstream keys to control request forwarding.',
          placeholder: '[{"upstream-api-key":"upstream-key","api-keys":["client-key"]}]',
        },
        oauthExcludedModelsJson: {
          label: 'Disabled models',
          description:
            'Choose an auth channel and select models to exclude from OAuth or file-backed credentials.',
          placeholder: '{"claude":["claude-opus-4.5"]}',
        },
        oauthModelAliasJson: {
          label: 'Model aliases',
          description:
            'Configure client-visible model aliases by channel and map them to upstream model names.',
          placeholder: '{"claude":[{"name":"claude-sonnet-4","alias":"sonnet","fork":true}]}',
        },
      },
      routingStrategies: {
        'round-robin': 'Round robin',
        'fill-first': 'Fill first',
        unknown: 'Unknown',
      },
      validation: {
        invalidField: 'Enter a valid value.',
        jsonParseError: 'JSON could not be parsed: {{message}}',
        summary: '{{count}} fields need attention',
      },
      json: {
        remove: 'Remove',
        unsupportedStructure:
          'This config contains a structure that is not supported by the visual editor. Maintain it in config file mode.',
        emptyRows: 'No rules configured.',
        addProvider: 'Add provider',
        addChannel: 'Add channel',
        addAlias: 'Add alias',
        addMapping: 'Add mapping',
        addUpstreamKey: 'Add upstream key',
        removeChannel: 'Remove channel',
        channelRuleCount: '{{count}} rules',
        columns: {
          provider: 'Model provider',
          models: 'Model IDs',
          channel: 'Channel',
          name: 'Upstream model',
          alias: 'Client alias',
          fork: 'Fork',
          from: 'Requested model',
          to: 'Upstream model',
          regex: 'Regex',
          actions: 'Actions',
          upstreamApiKey: 'Upstream API key',
          clientKeys: 'Client keys',
        },
        columnDescriptions: {
          channel: 'Auth channel key, such as claude, gemini, or codex.',
          name: 'Model ID actually sent to the upstream provider.',
          alias: 'Model alias that clients can request.',
          fork: 'Advanced option. The API only defines this as fork alias behavior; leave it off unless you need it.',
          from: 'Amp model name in the client request. When Regex is enabled, this is treated as a regular expression.',
          to: 'Target upstream model name after a match.',
          regex:
            'Off matches the full model name. On treats the requested model as a regular expression.',
        },
        modelMappings: {
          description:
            'Rewrite Amp CLI upstream models by requested model. Enable Regex only when pattern matching is needed.',
        },
        placeholders: {
          provider: 'claude',
          models: 'claude-opus-4.5, claude-sonnet-4',
          channel: 'claude',
          name: 'claude-sonnet-4',
          alias: 'sonnet',
          from: 'claude-opus-4.5',
          to: 'claude-sonnet-4',
          upstreamApiKey: 'upstream-key',
          clientKeys: 'client-key-1, client-key-2',
        },
      },
      oauthExcluded: {
        title: 'OAuth model disable list',
        channelLabel: 'Auth channel',
        reloadModels: 'Reload models',
        searchPlaceholder: 'Search model ID, name, or owner',
        selectedCount: '{{count}} models selected',
        clearChannel: 'Clear channel',
        emptyModels: 'No model definitions were returned for this channel.',
        emptyFiltered: 'No matching models.',
        customTitle: 'Custom provider rules',
        customDescription:
          'These providers are not in the current visual channel list. Maintain them in config file mode.',
        channels: {
          claude: 'Claude',
          gemini: 'Gemini',
          vertex: 'Vertex',
          'gemini-cli': 'Gemini CLI',
          aistudio: 'AI Studio',
          codex: 'Codex',
          kimi: 'Kimi',
          antigravity: 'Antigravity',
        },
      },
      diff: {
        title: 'Changes before save',
        empty: 'There are no config changes to save.',
        visualDescription:
          'Visual mode has {{count}} unsaved changes. Select an item to jump to its config section.',
        fileDescription:
          'Saving will fully overwrite the current config.yaml. Review changes first.',
        fileChanged: 'The config file content has changed. Saving replaces the full config.',
        addedLines: '{{count}} added',
        removedLines: '{{count}} removed',
        omittedLines: '{{count}} unchanged lines hidden',
      },
      yaml: {
        title: 'Config file mode',
        localWarning:
          'CPA and Home standalone read and replace the local config.yaml, usually preserving original comments and formatting.',
        clusterWarning:
          'Home cluster writes YAML into the cluster config repository. The server may remove credential roots and re-encode config.',
        searchPlaceholder: 'Search YAML',
        matches: '{{count}} matches',
      },
      confirm: {
        reload: 'Discard unsaved local changes and reload?',
        saveYaml: 'Config file mode replaces the full config. Save now?',
        switchMode: 'This mode has unsaved changes. Switching modes will discard them. Continue?',
      },
      confirmDialog: {
        switchModeTitle: 'Switch editing mode?',
        reloadTitle: 'Reload config?',
        saveYamlTitle: 'Save full config file?',
        discardAndSwitch: 'Discard and switch',
        discardAndReload: 'Discard and reload',
      },
      toast: {
        saved: 'Config saved.',
        validationFailed: 'Fix config validation issues first.',
      },
    },
    usageLogsPage: {
      disconnected: {
        title: 'Connect a management runtime',
        description:
          'Usage and logs are loaded from the Management API. Connect a runtime before reviewing request stats, queues, and logs.',
        action: 'Connect runtime',
      },
      error: {
        title: 'Usage and logs could not be loaded',
        description: 'Check the management endpoint, management key, and log-related routes.',
        retry: 'Retry',
      },
      header: {
        title: 'Usage & Logs',
        description:
          'Review model service request counts, API key usage, runtime logs, and downloadable request error logs.',
        updatedAt: 'Last synced: {{time}}',
      },
      actions: {
        refresh: 'Sync data',
        syncing: 'Syncing',
        clearLogs: 'Clear logs',
        download: 'Download',
        downloadRequestLog: 'Download request log',
        fetchQueue: 'Pull queue records',
      },
      capabilities: {
        usage: 'Usage stats',
        usageQueue: 'Usage queue',
        logs: 'Runtime logs',
        requestErrorLogs: 'Error logs',
      },
      unavailable: {
        title: 'This runtime does not expose usage and log routes',
        description:
          '{{mode}} does not expose runtime log or usage query routes. The page keeps capability state visible without inventing missing data.',
      },
      issues: {
        title: 'Some data could not be loaded',
      },
      issueScopes: {
        apiKeyUsage: 'Usage stats',
        usageQueue: 'Usage queue',
        logs: 'Runtime logs',
        requestErrorLogs: 'Error logs',
        clearLogs: 'Clear logs',
      },
      summary: {
        keys: 'Usage keys',
        keysDetail: '{{count}} recent request windows',
        requests: 'Request count',
        requestsDetail: '{{success}} success / {{failed}} failed',
        logs: 'Log lines',
        logsDetail: '{{count}} error log files',
      },
      usage: {
        title: 'API key usage',
        description:
          'Groups successful and failed requests by model provider, upstream Base URL, and API key.',
        empty:
          'No API key usage records were returned. Confirm usage statistics are enabled and the runtime has handled requests.',
        provider: 'Model provider',
        baseUrl: 'Base URL',
        key: 'Key',
        success: 'Success',
        failed: 'Failed',
        recentWindows: 'Recent windows',
      },
      queue: {
        title: 'Usage queue',
        description:
          'Read the runtime usage queue on demand. This route pops the earliest records, so it should not auto-refresh.',
        consumes:
          'Pulling queue records consumes records from the server queue. Run it only when investigating usage records.',
        unavailable: 'This runtime does not expose the usage queue route.',
        notLoaded: 'The queue has not been read. Pulling records consumes up to 20 queued records.',
        empty: 'No usage queue records were pulled.',
        raw: 'Raw record',
        columns: {
          request: 'Request ID',
          model: 'Model',
          endpoint: 'Endpoint',
          status: 'Status',
          actions: 'Actions',
        },
      },
      logs: {
        title: 'Runtime logs',
        description:
          'Reads recent lines from file logging. Empty content usually means file logging is disabled or nothing has been written yet.',
        unavailable: 'This runtime does not expose the runtime logs route.',
        empty:
          'No runtime log lines are available. Confirm file logging is enabled and the runtime has written logs.',
        lineCount: '{{count}} lines',
        latest: 'Latest timestamp: {{time}}',
        latestUnavailable: 'Latest timestamp unavailable',
      },
      errorLogs: {
        title: 'Error log files',
        description:
          'Lists error-*.log files generated when request logging is disabled, with file download support.',
        unavailable: 'This runtime does not expose the error log file route.',
        empty: 'No error log files were returned.',
        meta: '{{size}} bytes · {{time}}',
        searchPlaceholder: 'Search log file name, press Enter',
        columns: {
          name: 'Log',
          modified: 'Updated',
          size: 'Size',
          actions: 'Actions',
        },
      },
      status: {
        success: 'Success',
        failed: 'Failed',
        notAvailable: 'N/A',
        unknownRequest: 'Unknown request',
      },
      confirm: {
        clearLogsTitle: 'Clear runtime logs?',
        clearLogs: 'Clear runtime logs? This removes rotated files and truncates the active log.',
      },
      toast: {
        logsCleared: 'Logs cleared.',
        logDownloaded: 'Log downloaded.',
        queueFetched: '{{count}} queue records pulled.',
      },
    },
    systemNodesPage: {
      disconnected: {
        title: 'Connect a management runtime',
        description:
          'Runtime and diagnostic data is loaded from the Management API. Connect a runtime before reviewing versions, config summary, nodes, and diagnostic tools.',
        action: 'Connect runtime',
      },
      error: {
        title: 'Runtime and diagnostics could not be loaded',
        description: 'Check the management endpoint, management key, and system diagnostic routes.',
        retry: 'Retry',
      },
      header: {
        title: 'Runtime & Diagnostics',
        runtime: 'Runtime: {{mode}}',
        probedAt: 'Capabilities checked {{time}}',
        updatedAt: 'Last synced: {{time}}',
      },
      actions: {
        refresh: 'Sync data',
        syncing: 'Syncing',
        openDiagnostics: 'Diagnostics',
      },
      verdict: {
        ready: {
          title: 'System information is synced',
          badge: 'Normal',
          description:
            'Version, config, and node connection state are synced for the current runtime assessment.',
        },
        limited: {
          title: 'System information is synced',
          badge: 'Nodes unavailable',
          description:
            'This runtime does not expose the node query route. Use version and config summary as the primary signals.',
        },
        degraded: {
          title: 'System information partially failed to sync',
          badge: 'Partial failure',
          description:
            'The page continues to show loaded information. Resolve failed items before making a full assessment.',
        },
        unavailable: {
          title: 'System information is unavailable',
          badge: 'Unavailable',
          description:
            'Key diagnostic routes did not return usable data. Check the Management API, management key, and runtime diagnostic capabilities.',
        },
        facts: {
          config: 'Config summary: {{status}}',
          version: 'Version info: {{status}}',
          nodes: 'Node records: {{count}}',
          nodesUnsupported: 'Node route: unavailable',
          issues: 'Load issues: {{count}}',
          noIssues: 'No load issues',
        },
      },
      config: {
        empty: 'No config summary was returned.',
        title: 'Service config summary',
        fields: {
          debug: 'Debug mode',
          requestLog: 'Request logs',
          usageStatistics: 'Usage statistics',
          loggingToFile: 'File logging',
          proxyConfigured: 'Proxy endpoint',
          routingStrategy: 'Routing strategy',
        },
      },
      status: {
        enabled: 'Enabled',
        disabled: 'Disabled',
        connected: 'Connected',
        notAvailable: 'N/A',
        unknown: 'Unknown',
        available: 'Available',
      },
      nodes: {
        title: 'Node connections',
        unavailable: 'The current {{runtime}} runtime does not expose the node query route.',
        empty: 'No node connection records were returned.',
        emptySupported: 'The node route is available, but no connection records were returned.',
        connectedTime: 'Connected at {{time}}',
      },
      issues: {
        title: 'Some diagnostic data could not be loaded',
      },
      issueScopes: {
        latestVersion: 'Latest version',
        config: 'Config summary',
        nodes: 'Node connections',
        apiCall: 'Diagnostic request',
      },
      apiCall: {
        title: 'Management API diagnostic request',
        description:
          'Send one upstream request from the server to diagnose connectivity, credential, or upstream API issues.',
        riskTitle: 'High-privilege diagnostic action',
        warning:
          'This tool sends one upstream request from the server. Use it only to diagnose connection, credential, or upstream API issues. Avoid sending production-sensitive data.',
        method: 'Method',
        url: 'Target URL',
        urlPlaceholder: 'https://api.example.com/v1/ping',
        authIndex: 'Credential index',
        authIndexPlaceholder: 'Optional, leave blank to use the default credential',
        headers: 'Headers JSON',
        body: 'Body',
        bodyPlaceholder: 'Optional, body is sent as written',
        validation: {
          urlRequired: 'Enter a target URL.',
          headersJsonInvalid: 'Headers must be valid JSON.',
          headersObjectRequired: 'Headers JSON must be an object.',
        },
        run: 'Send diagnostic request',
        responseStatus: 'Response status: {{status}}',
      },
      summary: {
        version: 'Service version',
        latestVersion: 'Latest version: {{version}}',
        nodes: 'Nodes',
        nodesAvailable: 'Node route is available',
        nodesEmpty: 'Node route is available, no connection records yet',
        nodesConnected: '{{count}} nodes returned',
        nodesUnavailable: 'This runtime does not expose node queries',
        config: 'Config summary',
        configAvailable: 'Runtime config summary has been loaded',
        configUnavailable: 'Config summary route did not return usable data',
        apiCall: 'API diagnostics',
        apiCallDetail: 'Use /api-call to verify upstream connectivity',
      },
      toast: {
        apiCallComplete: 'Diagnostic request completed.',
      },
    },
    placeholder: {
      phase: 'Phase 0 scaffold',
      dashboard: {
        title: 'Dashboard',
        description:
          'The commercial console homepage will aggregate runtime status, provider coverage, credentials, access keys, nodes, and version signals.',
        itemOne:
          'Read GET /config, GET /latest-version, GET /auth-files, provider GET routes, and GET /nodes when available.',
        itemTwo:
          'Render capability-aware overview states for CPA, Home standalone, and Home cluster.',
      },
      providers: {
        title: 'Providers',
        description:
          'Provider keys will be managed as a workbench with provider grouping, tables, drawers, model definitions, and adapter-normalized identifiers.',
        itemOne: 'Cover Gemini, Claude, Codex, Vertex, and OpenAI-compatible provider routes.',
        itemTwo:
          'Normalize auth-index, auth_index, id, uuid, disabled, and per-provider field differences through adapters.',
      },
      credentials: {
        title: 'Credentials',
        description:
          'OAuth and file-backed credentials will be handled as a resource workspace with status toggles, metadata editing, downloads, uploads, and OAuth handoff.',
        itemOne:
          'Use GET /auth-files plus status, fields, upload, download, models, OAuth, and Vertex import routes.',
        itemTwo:
          'Handle file, memory, and db sources without assuming local file paths in cluster mode.',
      },
      accessKeys: {
        title: 'Access Keys',
        description:
          'Client-facing API keys will be managed separately from upstream provider keys, with masked display and focused create, edit, delete flows.',
        itemOne: 'Use GET, PUT, PATCH, and DELETE /api-keys.',
        itemTwo: 'Do not assume server-side metadata beyond the documented key array.',
      },
      config: {
        title: 'Config',
        description:
          'Configuration will use visual mode for common settings and config file mode for full replacement, with mode-aware save messaging.',
        itemOne: 'Use GET /config, GET /config.yaml, PUT /config.yaml, and simple leaf routes.',
        itemTwo:
          'Warn that cluster mode rewrites YAML from repository state and does not preserve comments.',
      },
      usageLogs: {
        title: 'Usage & Logs',
        description:
          'Usage and logs will be capability-aware analysis pages that degrade cleanly when Home cluster does not expose runtime log routes.',
        itemOne:
          'Use GET /api-key-usage, GET /usage-queue, GET /logs, DELETE /logs, and request error log routes when available.',
        itemTwo:
          'Render unavailable states instead of treating missing cluster routes as page failures.',
      },
      systemNodes: {
        title: 'System Info',
        description:
          'System information will expose runtime version, connection status, node connectivity, selected diagnostics, and guarded management API tools.',
        itemOne:
          'Use GET /nodes, GET /latest-version, GET /config, leaf routes, and guarded POST /api-call.',
        itemTwo: 'Only expose high-privilege diagnostic calls with explicit UI warnings.',
      },
    },
  },
}
