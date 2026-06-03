export const ru = {
  common: {
    productName: 'Home Center',
    productShortName: 'Home Center',
    productSubtitle: 'Коммерческая консоль',
    phaseBaseline: 'Базовая версия Phase 0',
    cancel: 'Отмена',
    common: {
      cancel: 'Отмена',
      enabled: 'Включено',
      disabled: 'Отключено',
    },
    actions: {
      connect: 'Подключить',
      manageConnection: 'Подключение',
    },
    language: {
      switch: 'Язык',
      simplifiedChinese: 'Китайский упрощенный',
      traditionalChinese: 'Китайский традиционный',
      english: 'Английский',
      russian: 'Русский',
    },
    theme: {
      switch: 'Переключить тему',
      mode: 'Режим',
      light: 'Светлая',
      dark: 'Темная',
      system: 'Системная',
    },
    navigation: {
      dashboard: 'Панель',
      providers: 'Модельные сервисы',
      credentials: 'Учетные данные аккаунтов',
      accessKeys: 'Управление ключами',
      users: 'Пользователи и доступ',
      config: 'Системная конфигурация',
      usageLogs: 'Использование и журналы',
      systemNodes: 'Сведения о системе',
    },
    navigationGroups: {
      operate: 'Работа',
      gateway: 'Шлюз',
      observe: 'Наблюдение',
      control: 'Управление',
    },
    navigationMeta: {
      dashboard: 'Обзор runtime',
      providers: 'Настройки модельных сервисов',
      credentials: 'Глобальный пул учетных данных',
      accessKeys: 'Контроль клиентского доступа',
      users: 'Пользователи и доступ',
      config: 'Основные настройки шлюза',
      usageLogs: 'Запросы и журналы',
      systemNodes: 'Runtime и диагностика',
    },
    sidebar: {
      controlPlane: 'Консоль управления AI Gateway',
      collapse: 'Свернуть боковую панель',
      expand: 'Развернуть боковую панель',
      openMobile: 'Открыть навигацию',
      closeMobile: 'Закрыть навигацию',
      connectionStatus: {
        connected: 'Подключено',
        disconnected: 'Нет подключения',
        error: 'Сбой подключения',
        checking: 'Проверка…',
        hint: 'Настройте endpoint и management key',
        errorHint: 'Проверьте endpoint и management key',
        runtime: 'Режим',
        endpoint: 'Endpoint',
        connectedAction: 'Настроить подключение {{mode}}',
        disconnectedAction: 'Открыть управление подключением',
        errorAction: 'Проверить настройки подключения',
      },
    },
    commandPalette: {
      label: 'Глобальная палитра команд',
      description: 'Поиск страниц консоли и доступных действий.',
      trigger: 'Поиск команд',
      shortcut: '⌘K',
      placeholder: 'Поиск страниц или действий',
      empty: 'Подходящие команды не найдены.',
      groups: {
        session: 'Подключение',
      },
      commands: {
        manageConnection: {
          title: 'Управление подключением',
          connected: 'Посмотреть или изменить текущее подключение Management API',
          disconnected: 'Подключить запущенный Management API runtime',
          keywords: 'runtime endpoint management key',
        },
        disconnect: {
          title: 'Отключиться',
          description: 'Очистить текущую сессию Management API',
          keywords: 'выход очистить сессия',
        },
      },
    },
    runtimeMode: {
      cpa: 'CPA',
      'home-standalone': 'Home standalone',
      'home-cluster': 'Home cluster',
      unknown: 'Неизвестный runtime',
    },
    connectionDialog: {
      title: 'Подключиться к запущенному серверу',
      description:
        'Введите endpoint сервера gateway и management key, чтобы активировать все возможности управления.',
      cancel: 'Отмена',
      close: 'Закрыть окно подключения',
      baseUrl: 'Management endpoint',
      baseUrlHint:
        'Можно указать origin сервиса или endpoint /v0/management. Консоль нормализует адрес автоматически.',
      detectedRuntime: 'Доступный management endpoint обнаружен: {{endpoint}}',
      detectedProxyEndpoint: 'Обнаружен same-origin proxy endpoint: {{endpoint}}',
      managementKey: 'Management key',
      managementKeyPlaceholder: 'Вставьте management key',
      remember: 'Запомнить подключение',
      rememberHint:
        'Сохраняет endpoint и key в этом браузере. Оставьте выключенным, чтобы хранить их только в сессии этой вкладки.',
      connect: 'Подключить',
      update: 'Обновить подключение',
      connecting: 'Подключение',
      disconnect: 'Отключить',
      connectedAs: 'Подключено к {{mode}}.',
      errors: {
        managementKeyRequired: 'Management key обязателен.',
      },
    },
    accessPortal: {
      shellSubtitle: 'Точка входа',
      eyebrow: 'Разделение доступа',
      title: 'Выберите способ входа',
      description:
        'Администраторы используют management key для консоли управления. Обычные пользователи будут входить по username и password в свой workspace.',
      admin: {
        title: 'Консоль администратора',
        description:
          'Управление глобальной конфигурацией, модельными сервисами, учетными данными, клиентскими ключами, пользователями и областями доступа.',
        available: 'Management key',
        connected: 'Подключено',
        action: 'Открыть admin подключение',
        resume: 'Открыть консоль',
      },
      user: {
        title: 'Workspace пользователя',
        description:
          'Просмотр личных ключей, использования и доступных моделей. Этот runtime пока не предоставляет user authentication API.',
        available: 'Username password',
        unavailable: 'API недоступен',
        login: 'Вход пользователя',
        register: 'Создать аккаунт',
        previewWorkspace: 'Проверить статус workspace',
      },
    },
    adminAccess: {
      back: 'Назад к выбору входа',
      title: 'Подключение администратора',
      description:
        'Подключитесь через Management API endpoint и management key. Этот вход предназначен для глобального администрирования, а не для обычного пользователя.',
    },
    userAccess: {
      back: 'Назад к выбору входа',
      fields: {
        username: 'Username',
        usernamePlaceholder: 'Введите username',
        password: 'Password',
        passwordPlaceholder: 'Введите password',
        confirmPassword: 'Подтвердите password',
        confirmPasswordPlaceholder: 'Введите password еще раз',
      },
      login: {
        title: 'Вход пользователя',
        description:
          'В будущем обычные пользователи будут входить здесь в свой ограниченный workspace.',
        action: 'Войти',
        switchPrompt: 'Нет аккаунта?',
        switchAction: 'Создать',
      },
      register: {
        title: 'Регистрация пользователя',
        description:
          'Здесь появится легкий flow создания аккаунта. Платежи, email verification и восстановление password не входят в первый scope Home.',
        action: 'Зарегистрироваться',
        switchPrompt: 'Уже есть аккаунт?',
        switchAction: 'Войти',
      },
      unavailable: {
        title: 'Этот runtime не предоставляет authentication для обычных пользователей',
        description:
          'Backend сейчас предоставляет только администраторское управление /users. User registration, login, session и personal resource routes пока отсутствуют.',
      },
    },
    userWorkspace: {
      back: 'Назад к выбору входа',
      title: 'Workspace пользователя',
      description:
        'Этот workspace зарезервирован для клиентских ключей, использования и доступных model scopes текущего пользователя.',
      login: 'Перейти ко входу',
      chooseAccess: 'Выбрать другой вход',
      unavailable: {
        title: 'Отсутствуют user session routes',
        description:
          'Backend пока не предоставляет /auth/login, /auth/me, /me/api-keys, /me/usage или /me/models, поэтому workspace недоступен.',
      },
    },
    dashboard: {
      disconnected: {
        title: 'Подключите management runtime',
        description:
          'Подключите Home Center Management API, чтобы увидеть состояние сервера, модельные сервисы, учетные данные аккаунтов, клиентские ключи и узлы.',
        detectedRuntime:
          'Доступный Management API найден. Введите management key, чтобы завершить подключение: {{endpoint}}',
        detectedProxyEndpoint:
          'Same-origin proxy endpoint найден. Введите management key, чтобы завершить подключение: {{endpoint}}',
        action: 'Подключить runtime',
      },
      error: {
        title: 'Не удалось загрузить данные панели',
        description: 'Проверьте management endpoint, management key и доступность runtime.',
        retry: 'Повторить',
      },
      health: {
        ready: {
          title: 'Сервис готов к модельным запросам',
          description:
            'Модельные сервисы, учетные данные аккаунтов и клиентские ключи доступны. Можно проверять использование, журналы и конфигурацию.',
        },
        needsModelService: {
          title: 'Сначала настройте модельный сервис',
          description:
            'Доступные модельные ключи не возвращены, поэтому шлюз может не обслуживать модельные запросы. Добавьте хотя бы один ключ модельного сервиса.',
        },
        needsCredential: {
          title: 'Нужны учетные данные аккаунта',
          description:
            'Модельные сервисы подключены, но доступные учетные данные аккаунтов не возвращены. Каналы OAuth или файловых учетных данных могут не работать.',
        },
        needsClientKey: {
          title: 'Создайте клиентский ключ доступа',
          description:
            'На сервере есть данные доступа к моделям, но нет клиентского ключа для вызова серверного API.',
        },
        limited: {
          title: 'Сервис подключен с ограниченными возможностями',
          description:
            'Основные данные загружены, но этот runtime не предоставляет все observability routes. Управление моделями, учетными данными и конфигурацией остается доступным.',
        },
        degraded: {
          title: 'Сервис подключен, есть пункты для проверки',
          description:
            'Основные данные загружены, но ошибки запросов, Debug режим или маршрутизация требуют проверки. Начните с рекомендуемых действий ниже.',
        },
      },
      header: {
        eyebrow: 'Обзор',
        title: 'Обзор серверной части',
        description:
          'Проверьте, работает ли подключенный gateway server, какие модельные сервисы настроены, и доступны ли клиентские ключи и учетные данные аккаунтов.',
        refresh: 'Синхронизировать',
        syncing: 'Синхронизация',
        runtime: 'Подключенный сервер: {{mode}}',
        version: 'Последняя доступная версия: {{version}}',
        updatedAt: 'Последняя синхронизация: {{time}}',
      },
      recommendedActions: {
        title: 'Рекомендуемые действия',
        configureProviders: 'Настроить модельный сервис',
        addCredential: 'Добавить учетные данные',
        createClientKey: 'Создать клиентский ключ',
        checkRouting: 'Проверить маршрутизацию',
        reviewDebug: 'Проверить Debug режим',
        reviewDataStatus: 'Проверить состояние данных',
      },
      status: {
        unknown: 'Неизвестно',
        enabled: 'Включено',
        disabled: 'Выключено',
        available: 'Доступно',
        unavailable: 'Недоступно',
        notAvailableShort: 'Н/Д',
      },
      metrics: {
        providers: {
          title: 'Доступные модельные ключи',
          detail: 'Подключено типов модельных сервисов: {{count}}',
        },
        credentials: {
          title: 'Доступные учетные данные',
          detail: 'Найдено записей учетных данных: {{count}}',
        },
        clientKeys: {
          title: 'Клиентские ключи доступа',
          detail: 'Ключей для вызова серверного API: {{count}}',
        },
        nodes: {
          title: 'Runtime узлы',
          detail: 'Узлов от текущего сервиса: {{count}}',
        },
      },
      quickActions: {
        title: 'Быстрые переходы',
        description: 'Открыть часто используемые страницы управления.',
        providers: {
          title: 'Модельные сервисы',
          description: 'Проверить ключи модельных сервисов и отключенные записи.',
        },
        credentials: {
          title: 'Учетные данные',
          description: 'Проверить состояние OAuth и file-backed аккаунтов.',
        },
        accessKeys: {
          title: 'Управление ключами',
          description: 'Управлять ключами, которыми клиенты вызывают серверный API.',
        },
        config: {
          title: 'Системная конфигурация',
          description: 'Настроить маршрутизацию, журналы и YAML.',
        },
        systemNodes: {
          title: 'Сведения о системе',
          description: 'Проверить версии, состояние подключения, узлы и диагностику.',
        },
      },
      providers: {
        title: 'Подключение модельных сервисов',
        description:
          'Проверьте общее, доступное и отключенное количество ключей для каждого типа модельного сервиса.',
        emptyTitle: 'Модельные сервисы не настроены',
        emptyDescription:
          'Модельные ключи не возвращены. Добавьте модельный сервис, чтобы шлюз мог перенаправлять запросы upstream.',
        emptySupportedProviders:
          'Поддерживаются Gemini, Claude, Codex, Vertex, OpenAI-compatible сервисы и AMP.',
        configureAction: 'Настроить модельный сервис',
        total: 'Всего',
        active: 'Доступно',
        disabled: 'Отключено',
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
        title: 'Ключевые переключатели',
        description: 'Настройки, влияющие на журналы, статистику использования и маршрутизацию.',
      },
      configChecks: {
        requestLog: 'Журнал запросов',
        usageStatistics: 'Статистика использования',
        fileLogging: 'Файловые журналы',
        debug: 'Debug режим',
        routing: 'Стратегия маршрутизации',
      },
      capabilities: {
        title: 'Доступные функции',
        description: 'Функции управления, поддерживаемые подключенным сервисом.',
      },
      capabilityNames: {
        nodes: 'Управление узлами',
        usage: 'Статистика использования',
        logs: 'Журналы запросов',
        requestErrorLogs: 'Журналы ошибок',
        users: 'Управление пользователями',
        accessGroups: 'Области доступа',
      },
      credentials: {
        title: 'Источники учетных данных',
        description:
          'Записи аккаунтов, сгруппированные по способу хранения, включая OAuth-вход и файлы учетных данных.',
        empty: 'Записи учетных данных аккаунтов не возвращены.',
      },
      credentialSourceNames: {
        file: 'Файл',
        memory: 'Память',
        db: 'База данных',
        unknown: 'Неизвестный источник',
      },
      issues: {
        title: 'Состояние загрузки данных',
        description: 'Показывает, полностью ли доступны данные панели и возможности runtime.',
        empty: 'Данные панели загружены полностью.',
        requestFailed: 'Запрос не выполнен: {{status}}',
        unavailableCapability: 'Не предоставляется этим runtime',
      },
      issueScopes: {
        latestVersion: 'Последняя версия',
        clientKeys: 'Клиентские ключи',
        authFiles: 'Учетные данные аккаунтов',
        nodes: 'Узлы',
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
        title: 'Подключите management runtime',
        description:
          'Модельные ключи загружаются из Management API. Подключите runtime перед просмотром или изменением ключей модельных сервисов.',
        action: 'Подключить runtime',
      },
      error: {
        title: 'Не удалось загрузить данные поставщиков моделей',
        description: 'Проверьте management endpoint, key и маршруты поставщиков моделей.',
        retry: 'Повторить',
      },
      header: {
        eyebrow: 'Рабочая область поставщиков моделей',
        title: 'Поставщики моделей',
        description:
          'Управление ключами модельных сервисов через нормализованные standalone и cluster идентификаторы без изменения backend API contract.',
        activeResources: '{{active}} активных из {{total}} модельных ключей',
        providerFamilies: 'Настроено типов поставщиков моделей: {{count}}',
        updatedAt: 'Последняя синхронизация: {{time}}',
        issueCount: 'Частичных проблем: {{count}}',
      },
      actions: {
        refresh: 'Синхронизировать',
        syncing: 'Синхронизация',
        new: 'Новый модельный ключ',
        create: 'Создать',
        save: 'Сохранить',
        cancel: 'Отмена',
        view: 'Открыть',
        edit: 'Изменить',
        delete: 'Удалить',
      },
      categories: {
        title: 'Поставщики моделей',
        activeCount: '{{active}} / {{total}} активных',
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
        filterPlaceholder: 'Фильтр модельных ключей',
        empty: 'Нет модельных ключей для текущего поставщика моделей и фильтра.',
        providerIssue: 'Этот маршрут поставщика моделей вернул проблему',
        key: 'Key / identity',
        baseUrl: 'Base URL',
        prefix: 'Prefix',
        models: 'Модели',
        status: 'Статус',
        actions: 'Действия',
        modelSummary: '{{models}} моделей · {{headers}} headers',
      },
      modelCatalog: {
        title: 'Справочник доступных моделей',
        description:
          'Модельные определения для {{provider}} только для чтения. Смена справочного канала обновляет только этот список. Она не меняет поставщика моделей или модельные ключи выше.',
        standaloneDescription:
          'Модельные определения для справочного канала {{channel}} только для чтения. Смена канала обновляет только этот список. Она не меняет поставщика моделей или модельные ключи выше.',
        summaryTitle: 'Справочник доступных моделей',
        summaryCount: '{{count}} моделей',
        summaryError: 'Ошибка загрузки',
        loading: 'Загрузка',
        openAction: 'Открыть модели',
        retry: 'Повторить',
        channelLabel: 'Справочный канал',
        filterPlaceholder: 'Фильтр моделей',
        updatedAt: 'Обновлено {{time}}',
        notLoaded: 'Не загружено',
        empty: 'Нет model definitions для текущего channel и фильтра.',
        errorTitle: 'Не удалось загрузить каталог моделей',
        contextLength: 'Контекст {{value}}',
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
          xai: 'xAI',
        },
      },
      status: {
        active: 'Активно',
        disabled: 'Отключено',
        none: 'Нет',
        notSet: 'Не задано',
        notAvailable: 'Н/Д',
      },
      detail: {
        title: 'Детали модельного ключа',
        empty: 'Выберите модельный ключ или создайте новую запись.',
        metadataTitle: 'Дополнительные метаданные',
        fields: {
          identifier: 'Идентификатор',
          authIndex: 'Auth index',
          baseUrl: 'Base URL',
          proxyUrl: 'Proxy URL',
          prefix: 'Prefix',
          models: 'Модели',
          headers: 'Headers',
          excludedModels: 'Исключенные модели',
          apiKeyEntries: 'API key entries',
        },
      },
      form: {
        createEyebrow: 'Новый модельный ключ',
        editEyebrow: 'Изменить модельный ключ',
        name: 'Имя поставщика моделей',
        apiKey: 'Ключ модельного сервиса',
        apiKeyCreatePlaceholder: 'Вставьте ключ модельного сервиса',
        apiKeyEditPlaceholder: 'Оставьте пустым, чтобы сохранить текущий ключ',
        baseUrl: 'Base URL',
        baseUrlRequiredHint:
          'Для Codex и OpenAI-compatible providers требуется Base URL. Backend игнорирует записи с пустым Base URL.',
        proxyUrl: 'Proxy URL',
        prefix: 'Model prefix',
        priority: 'Приоритет',
        disabled: 'Отключено',
        disabledHint: 'Отключенная запись не используется для upstream requests.',
        cloakSection: 'Cloak configuration',
        cloakHint: 'Только Claude. Настройка request cloaking и обработки sensitive words.',
        cloakMode: 'Cloak mode',
        cloakStrict: 'Strict mode',
        cloakStrictHint: 'Применяет более строгие правила для cloaked requests.',
        cloakCacheUserId: 'Cache user ID',
        cloakCacheUserIdHint: 'Разрешает backend кэшировать user identity для cloaked requests.',
        cloakSensitiveWords: 'Sensitive words',
        modelsSection: 'Пользовательские модели',
        modelsHint:
          'Свяжите upstream model ID с клиентскими alias. Результаты из endpoint можно добавить здесь.',
        modelName: 'Model ID',
        modelAlias: 'Alias',
        addModel: 'Добавить модель',
        removeModel: 'Удалить модель',
        excludedModels: 'Исключенные модели',
        excludedModelsHint: 'Один model ID на строку, либо разделяйте model ID запятыми.',
        headersSection: 'Request Headers',
        headersHint: 'Добавьте upstream request headers для этого модельного ключа.',
        headerName: 'Имя Header',
        headerValue: 'Значение Header',
        addHeader: 'Добавить Header',
        removeHeader: 'Удалить Header',
        validation: {
          nameRequired: 'Введите имя поставщика моделей перед сохранением.',
          apiKeyRequired: 'Введите ключ модельного сервиса перед сохранением.',
          baseUrlRequired:
            'Введите Base URL перед сохранением. Codex и OpenAI-compatible providers не могут использовать пустой Base URL.',
          modelNameRequired: 'Введите model ID, если задан alias.',
          headerNameRequired: 'Введите имя Header, если задано значение Header.',
        },
      },
      discovery: {
        title: 'Получить удаленные модели',
        description: 'Импорт model ID из upstream list.',
        openButton: 'Получить модели',
        reload: 'Получить заново',
        authStatusLabel: 'Источник auth',
        baseUrlStatusLabel: 'Endpoint списка моделей',
        authStatus: {
          apiKey: 'Используется model service key выше',
          savedCredential: 'Используется сохраненная учетная запись',
          header: 'Используется request Header',
          missing: 'Не задано',
        },
        baseUrlStatus: {
          ready: 'Base URL задан',
          default: 'Используется официальный default endpoint',
          missing: 'Base URL не задан',
        },
        disabledReason: {
          apiKeyAndBaseUrlRequired: 'Нет ключа и Base URL',
          apiKeyRequired: 'Нет model service key',
          baseUrlRequired: 'Нет Base URL',
        },
        searchPlaceholder: 'Поиск моделей',
        loading: 'Получение моделей...',
        networkError:
          'Запрос списка моделей не вернул читаемый ответ. Проверьте backend /api-call, состояние gateway или CORS headers в error responses.',
        empty: 'Доступные модели не найдены.',
        notLoaded: 'Модели еще не загружены.',
        selectAll: 'Выбрать текущие результаты',
        clearAll: 'Очистить выбор',
        selectedCount: 'Выбрано {{selected}} / {{total}}',
        alreadyAdded: 'Добавлено',
        close: 'Свернуть',
        apply: 'Добавить модели: {{count}}',
        validation: {
          apiKeyAndBaseUrlRequired:
            'Перед получением моделей введите model service key выше и Base URL.',
          apiKeyRequired: 'Перед получением моделей введите model service key выше.',
          baseUrlRequired: 'Перед получением моделей введите Base URL.',
        },
      },
      connectivity: {
        testModel: 'Тестовая модель',
        testModelPlaceholder: 'Если пусто, используется первая custom model',
        testModelSearchPlaceholder: 'Найдите модель или введите model ID',
        testModelAutoOption: 'Авто: использовать первую custom model',
        testModelSearchEmpty: 'Совпадений нет. Можно ввести model ID вручную.',
        testModelHint: 'Отправляет один connectivity request. Форма не сохраняется.',
        test: 'Тест',
        success: 'Connectivity test passed.',
        networkError:
          'Тестовый запрос не вернул читаемый ответ. Проверьте backend /api-call, gateway status или CORS headers.',
        validation: {
          apiKeyAndBaseUrlRequired: 'Перед тестом введите model service key и Base URL.',
          apiKeyRequired: 'Перед тестом введите model service key.',
          baseUrlRequired: 'Перед тестом введите Base URL.',
          modelRequired: 'Перед тестом введите test model или добавьте хотя бы одну custom model.',
        },
      },
      delete: {
        title: 'Удалить модельный ключ?',
        confirm: 'Удалить модельный ключ "{{name}}"?',
      },
      toast: {
        created: 'Ключ модели создан.',
        updated: 'Ключ модели обновлен.',
        deleted: 'Ключ модели удален.',
      },
    },
    credentialsPage: {
      disconnected: {
        title: 'Подключите management runtime',
        description:
          'Credentials загружаются из Management API. Подключите runtime перед просмотром OAuth и file-backed ресурсов.',
        action: 'Подключить runtime',
      },
      error: {
        title: 'Не удалось загрузить credentials',
        description: 'Проверьте management endpoint, key и auth-files route.',
        retry: 'Повторить',
      },
      header: {
        eyebrow: 'Рабочая область credentials',
        title: 'OAuth и file-backed credentials',
        description:
          'Управляйте учетными данными runtime как ресурсами: источник, статус, metadata аккаунта, тип поставщика моделей и операции.',
        activeResources: '{{active}} активных из {{total}} credentials',
        disabledCount: 'Отключено: {{count}}',
        unavailableCount: 'Недоступно: {{count}}',
        updatedAt: 'Последняя синхронизация: {{time}}',
      },
      actions: {
        refresh: 'Синхронизировать',
        syncing: 'Синхронизация',
        addCredential: 'Добавить credential',
        upload: 'Загрузить JSON',
        save: 'Сохранить metadata',
        view: 'Просмотр',
        edit: 'Изменить',
        loadModels: 'Загрузить модели',
        viewModels: 'Показать модели',
        reloadModels: 'Обновить',
        enable: 'Включить',
        disable: 'Отключить',
        returnToDetail: 'Назад к деталям',
        download: 'Скачать',
        delete: 'Удалить',
      },
      filters: {
        status: 'Статус',
        source: 'Источник',
        provider: 'Поставщик моделей',
        allSources: 'Все источники',
        allProviders: 'Все поставщики моделей',
      },
      statusFilters: {
        all: 'Все credentials',
        active: 'Активные',
        disabled: 'Отключенные',
        unavailable: 'Недоступные',
      },
      create: {
        title: 'Добавить account credential',
        description:
          'Выберите вход, загрузку или импорт. Новые credentials появятся в списке ресурсов.',
        modes: {
          oauth: 'OAuth вход',
          upload: 'Загрузка JSON',
          vertex: 'Импорт Vertex',
        },
      },
      oauth: {
        title: 'OAuth вход',
        startLogin: 'Создать ссылку авторизации',
        showAdvanced: 'Показать дополнительные опции',
        hideAdvanced: 'Скрыть дополнительные опции',
        authorizationLinkTitle: 'Ссылка авторизации создана',
        authorizationLinkDescription:
          'Сначала скопируйте ссылку в нужный браузер или профиль аккаунта. Открывайте ее здесь только если этот браузер подходит для авторизации.',
        authorizationLink: 'Ссылка авторизации',
        copyAuthorizationLink: 'Скопировать ссылку',
        openAuthorizationLink: 'Открыть ссылку',
        closureTitle: 'Статус авторизации и callback',
        closureDescription:
          'Вход запущен. Проверьте статус авторизации здесь или отправьте callback URL, если browser redirect не был обработан автоматически.',
        lastProvider: 'Последний поставщик',
        lastState: 'State',
        statusState: 'Токен статуса авторизации',
        statePlaceholder: 'OAuth state',
        statusNotChecked: 'Статус авторизации еще не проверялся.',
        checkStatus: 'Проверить статус',
        callbackProvider: 'Поставщик моделей',
        callbackState: 'Токен статуса callback',
        redirectUrl: 'Полный callback URL',
        xaiCallbackInput: 'Callback URL или код со страницы',
        xaiCallbackPlaceholder: 'Вставьте код, показанный Grok, или полный callback URL',
        authorizationCode: 'Authorization code',
        callbackError: 'Сообщение об ошибке',
        submitCallback: 'Отправить callback URL',
        geminiProjectLabel: 'Gemini Project ID',
        geminiProjectPlaceholder: 'Project ID, необязательно',
        geminiProjectHint:
          'Оставьте пустым, чтобы runtime выбрал первый доступный project. Введите ALL, чтобы получить все projects.',
        callbackUnsupported:
          'Этот способ входа завершается через опрос статуса runtime и не требует ручного callback URL.',
        providerHints: {
          claude: 'Создать account credential через Claude OAuth.',
          codex: 'Создать account credential через Codex OAuth.',
          gemini: 'Создать Google account credential через Gemini CLI OAuth.',
          antigravity: 'Создать Google account credential через Antigravity OAuth.',
          kimi: 'Создать account credential через Kimi device flow.',
          xai: 'Создать account credential через xAI/Grok OAuth.',
        },
        statuses: {
          ok: 'Завершено',
          wait: 'Ожидание',
          error: 'Ошибка',
          unknown: 'Неизвестно',
        },
        validation: {
          stateRequired: 'Введите OAuth state.',
          callbackPayloadRequired:
            'Введите callback URL, authorization code или сообщение об ошибке.',
          xaiStateRequired: 'Сначала запустите вход xAI или введите полный callback URL со state.',
        },
        providers: {
          claude: 'Claude',
          codex: 'Codex',
          gemini: 'Gemini CLI',
          antigravity: 'Antigravity',
          kimi: 'Kimi',
          xai: 'xAI / Grok',
        },
      },
      vertex: {
        title: 'Импорт Vertex credential',
        description:
          'Загрузите Vertex service account JSON и создайте credential для Gemini/Vertex.',
        file: 'Service account JSON',
        location: 'Vertex location',
        import: 'Импортировать Vertex credential',
        fields: {
          status: 'Статус',
          projectId: 'Project ID',
          email: 'Service account',
          location: 'Location',
          authFile: 'Auth file',
        },
        validation: {
          fileRequired: 'Выберите service account JSON для импорта.',
        },
      },
      upload: {
        title: 'Загрузить credential JSON',
        description: 'Выберите файлы или перетащите JSON сюда. Можно выбрать несколько файлов.',
      },
      list: {
        title: 'Credential resources',
        description: 'Управление account credentials из OAuth входа или file import.',
        filterPlaceholder: 'Фильтр credentials',
        empty: 'Нет credentials для текущих фильтров.',
        credential: 'Credential / аккаунт',
        provider: 'Поставщик моделей',
        source: 'Источник',
        type: 'Тип',
        status: 'Статус',
        updatedAt: 'Обновлено',
        actions: 'Действия',
      },
      sourceNames: {
        file: 'Файл',
        memory: 'Память',
        db: 'База данных',
        unknown: 'Неизвестный источник',
      },
      status: {
        active: 'Активно',
        enabled: 'Включено',
        disabled: 'Отключено',
        unavailable: 'Недоступно',
        notSet: 'Не задано',
        notAvailable: 'Н/Д',
      },
      detail: {
        title: 'Детали credential',
        empty: 'Выберите credential, чтобы посмотреть metadata и действия.',
        noModels: 'Для этого credential модели не вернулись.',
        modelsTitle: 'Доступные модели',
        modelsDescription: 'Запросить у runtime модели, доступные для этого credential.',
        modelCount: 'Загружено моделей: {{count}}.',
        statusActionTitle: 'Статус credential',
        enableDescription:
          'Этот credential отключен. Включите его, чтобы снова использовать в запросах моделей.',
        disableDescription:
          'Отключите credential, чтобы исключить его из запросов моделей. Его можно включить позже.',
        fields: {
          provider: 'Поставщик моделей',
          type: 'Тип',
          source: 'Источник',
          account: 'Аккаунт',
          authIndex: 'Auth index',
          path: 'Путь',
          size: 'Размер',
          priority: 'Приоритет',
          websockets: 'WebSocket',
          success: 'Успешно',
          failed: 'Ошибки',
          updatedAt: 'Обновлено',
          lastRefresh: 'Последний refresh',
          note: 'Заметка',
        },
      },
      form: {
        eyebrow: 'Изменить metadata',
        contextTitle: 'Текущий credential',
        editableHint:
          'Здесь можно изменить только Prefix, Proxy URL, приоритет и заметку. Аккаунт, источник и поставщик моделей приходят из записи credential в runtime.',
        editableHintWithWebsockets:
          'Здесь можно изменить Prefix, Proxy URL, приоритет, Codex WebSocket и заметку. Аккаунт, источник и поставщик моделей приходят из записи credential в runtime.',
        context: {
          provider: 'Поставщик моделей',
          source: 'Источник',
          account: 'Аккаунт',
          identifier: 'Идентификатор',
        },
        prefix: 'Prefix',
        proxyUrl: 'Proxy URL',
        priority: 'Приоритет',
        websockets: 'Поддержка WebSocket',
        websocketsHint:
          'Только для Codex credentials. Включите, если этот credential должен обрабатывать Codex requests с WebSocket.',
        note: 'Заметка',
      },
      delete: {
        title: 'Удалить credential?',
        confirm: 'Удалить credential "{{name}}"?',
      },
      toast: {
        uploaded: 'Credential file загружен.',
        downloaded: 'Credential скачан.',
        updated: 'Credential metadata обновлена.',
        deleted: 'Credential удален.',
        statusUpdated: 'Credential status обновлен.',
        oauthStarted: 'Ссылка OAuth авторизации создана.',
        oauthLinkCopied: 'Ссылка OAuth авторизации скопирована.',
        oauthStatusChecked: 'OAuth status: {{status}}.',
        oauthCallbackSubmitted: 'OAuth callback отправлен.',
        vertexImported: 'Vertex credential импортирован.',
      },
    },
    accessKeysPage: {
      disconnected: {
        title: 'Подключите management runtime',
        description:
          'Клиентские ключи доступа загружаются из Management API. Подключите runtime перед управлением клиентскими ключами.',
        action: 'Подключить runtime',
      },
      error: {
        title: 'Не удалось загрузить access keys',
        description: 'Проверьте management endpoint, key и route /api-keys.',
        retry: 'Повторить',
      },
      header: {
        eyebrow: 'Контроль клиентского доступа',
        title: 'Клиентские ключи доступа',
        description:
          'Управляйте ключами, которыми клиенты вызывают серверный API. Они отделены от ключей модельных сервисов.',
        total: 'Настроено ключей: {{count}}',
        accepted: 'Принимаются proxy runtime',
        updatedAt: 'Последняя синхронизация: {{time}}',
      },
      actions: {
        refresh: 'Синхронизировать',
        syncing: 'Синхронизация',
        new: 'Новый ключ',
        create: 'Создать ключ',
        save: 'Сохранить ключ',
        view: 'Просмотр',
        edit: 'Изменить',
        delete: 'Удалить',
        copy: 'Копировать',
        reveal: 'Показать',
        hide: 'Скрыть',
        generate: 'Сгенерировать ключ',
        replace: 'Заменить все',
      },
      list: {
        title: 'Access keys',
        description: 'Keys из GET /api-keys. Server-side metadata не предполагается.',
        filterPlaceholder: 'Фильтр keys',
        empty: 'Нет access keys для текущего фильтра.',
        index: 'N',
        key: 'Key',
        owner: 'Владелец',
        credentialScope: 'Credential scope',
        modelScope: 'Model scope',
        unassigned: 'Не назначен',
        unrestricted: 'Без ограничений',
        length: 'Длина',
        status: 'Статус',
        actions: 'Действия',
        prefixSuffix: '{{prefix}}…{{suffix}}',
      },
      status: {
        accepted: 'Accepted',
      },
      bulk: {
        selectAll: 'Выбрать все ключи в текущем списке',
        selectOne: 'Выбрать access key {{key}}',
        selected: 'Выбрано ключей: {{count}}',
        clearSelection: 'Снять выбор',
        deleteSelected: 'Удалить выбранные',
        deleteTitle: 'Удалить выбранные access keys?',
        deleteConfirm: 'Удалить выбранные access keys: {{count}}?',
      },
      detail: {
        title: 'Детали key',
        empty: 'Выберите key или создайте новый.',
        secret: 'Secret value',
        fields: {
          prefix: 'Prefix',
          suffix: 'Suffix',
          length: 'Длина',
          owner: 'Владелец',
          credentialScope: 'Credential scope',
          modelScope: 'Model scope',
        },
      },
      form: {
        createEyebrow: 'Создать access key',
        editEyebrow: 'Изменить access key',
        createTitle: 'Новый downstream key',
        editTitle: 'Обновить downstream key',
        keyValue: 'Key value',
        validation: {
          required: 'Key value обязателен.',
        },
      },
      replace: {
        eyebrow: 'Полная замена',
        title: 'Заменить все access keys',
        description:
          'Использует PUT /api-keys и заменяет весь список downstream keys. Один key на строку.',
        warning:
          'После отправки список ключей будет перезаписан. Для неизмененных ключей сохраняются владелец и области доступа; новые ключи начинают без ограничений.',
        textarea: 'Keys',
        confirm:
          'Заменить все access keys введенным списком? Привязки областей сохраняются только для неизмененных ключей.',
      },
      delete: {
        title: 'Удалить access key?',
        confirm: 'Удалить access key {{key}}?',
      },
      toast: {
        copied: 'Access key скопирован.',
        created: 'Access key создан.',
        updated: 'Access key обновлен.',
        replaced: 'Список access keys заменен.',
        deleted: 'Access key удален.',
        bulkDeleted: 'Удалено access keys: {{count}}.',
      },
    },
    usersPage: {
      disconnected: {
        title: 'Подключите management runtime',
        description:
          'Пользователи, клиентские ключи и области доступа загружаются из Management API. Подключите runtime перед управлением базовым многопользовательским доступом.',
        action: 'Подключить runtime',
      },
      unsupported: {
        title: 'Этот runtime не предоставляет управление пользователями',
        description:
          '{{mode}} не объявил поддержку управления пользователями. Страница не будет загружать таблицы управления пользователями и не будет подставлять пользователей, владельцев ключей или области доступа.',
      },
      error: {
        title: 'Не удалось загрузить пользователей',
        description: 'Проверьте management endpoint, management key и маршрут /users.',
        retry: 'Повторить',
      },
      header: {
        eyebrow: 'Пользователи и доступ',
        title: 'Пользователи и доступ',
        description:
          'Управляйте пользователями, владельцами клиентских ключей, областями учетных данных и областями моделей через Home Management API.',
        total: 'Пользователей: {{count}}',
        users: 'Пользователей: {{count}}',
        activeUsers: 'Активных пользователей: {{count}}',
        keys: 'Клиентских ключей: {{count}}',
        assignedKeys: 'Назначенных ключей: {{count}}',
        updatedAt: 'Последняя синхронизация: {{time}}',
      },
      actions: {
        refresh: 'Синхронизировать',
        syncing: 'Синхронизация',
        new: 'Новый пользователь',
        newUser: 'Новый пользователь',
        newKey: 'Новый ключ',
        newCredentialScope: 'Новая область учетных данных',
        newModelScope: 'Новая область моделей',
        create: 'Создать пользователя',
        createKey: 'Создать ключ',
        createCredentialScope: 'Создать область учетных данных',
        createModelScope: 'Создать область моделей',
        save: 'Сохранить изменения',
        addBinding: 'Добавить связь',
        retry: 'Повторить',
        view: 'Открыть',
        edit: 'Изменить',
        delete: 'Удалить',
      },
      status: {
        active: 'Активен',
        deleted: 'Удален',
        notAvailable: 'Недоступно',
        notReturned: 'Не возвращено',
        notDeleted: 'Не удален',
      },
      list: {
        title: 'Пользователи',
        description:
          'Проверяйте пользователей, владельцев клиентских ключей и назначенные области доступа.',
        filterPlaceholder: 'Фильтр по пользователям или ключам',
        empty: 'Нет пользователей для текущего фильтра.',
        user: 'Пользователь',
        status: 'Статус',
        keys: 'Client keys',
        updatedAt: 'Обновлено',
        actions: 'Действия',
      },
      form: {
        createTitle: 'Новый пользователь',
        editTitle: 'Изменить пользователя',
        username: 'Username',
        usernamePlaceholder: 'user@example.com',
        usernameLockedHint:
          'Username идентифицирует субъект доступа и блокируется после создания. Чтобы изменить его, удалите пользователя и создайте заново.',
        password: 'Начальный пароль',
        passwordOptional: 'Новый пароль (необязательно)',
        passwordPlaceholder:
          'Необязательно. Оставьте пустым, чтобы создать пользователя без пароля.',
        noGroups: 'Пока нет доступных областей.',
        noCredentialGroups: 'Области учетных данных еще не созданы.',
        noModelGroups: 'Области моделей еще не созданы.',
        validation: {
          usernameRequired: 'Username обязателен.',
          keyRequired: 'Значение ключа обязательно.',
          groupNameRequired: 'Название области обязательно.',
          groupRequired: 'Выберите область.',
          authRequired: 'Выберите учетные данные.',
          authAlreadyBound: 'Эти учетные данные уже связаны с текущей областью.',
          modelRequired: 'Выберите модель.',
          modelAlreadyBound: 'Эта модель уже связана с текущей областью.',
        },
      },
      keys: {
        keyValue: 'Значение ключа',
        owner: 'Владелец',
        unassigned: 'Не назначен',
        emptyScopeHint:
          'Если область не выбрана, ключ не добавляет ограничений по учетным данным или моделям.',
        empty: 'Клиентских ключей пока нет.',
        key: 'Клиентский ключ',
        length: 'Длина',
        sequence: 'Номер {{index}}',
        createTitle: 'Новый клиентский ключ',
        editTitle: 'Изменить доступ ключа',
      },
      scopes: {
        credential: 'Область учетных данных',
        model: 'Область моделей',
        unrestricted: 'Без ограничений',
      },
      groups: {
        channelName: 'Название области учетных данных',
        modelName: 'Название области моделей',
        disabled: 'Отключено',
        disabledHint: 'Отключенные области не используются backend для проверки доступа.',
        group: 'Область',
        groupPlaceholder: 'Выберите область',
        credential: 'Учетные данные аккаунта',
        credentialSearchPlaceholder: 'Поиск по названию, provider или ID',
        credentialEmpty: 'Нет учетных данных аккаунта, доступных для выбора.',
        credentialSearchEmpty: 'Нет учетных данных аккаунта по условиям поиска.',
        credentialAlreadyBound: 'Связано',
        credentialUnavailable: 'Недоступно',
        credentialSelectHint:
          'Показаны только учетные данные с явным Auth ID. Уже связанные или недоступные учетные данные нельзя выбрать повторно.',
        authId: 'Credential ID',
        model: 'Модель',
        modelId: 'Model ID',
        modelSearchPlaceholder: 'Поиск по названию модели, provider, каналу или ID',
        modelCandidateEmpty: 'Нет моделей, доступных для выбора.',
        modelSearchEmpty: 'Нет моделей по условиям поиска.',
        modelAlreadyBound: 'Связано',
        modelScopeAvailable: 'Доступна runtime',
        modelScopeStatic: 'Статический каталог',
        modelSelectHint:
          'Сначала показаны модели, доступные в текущем runtime, затем статический каталог. Уже связанные модели нельзя выбрать повторно.',
        channelEmpty: 'Областей учетных данных пока нет.',
        modelEmpty: 'Областей моделей пока нет.',
        detailCount: 'Связей: {{count}}',
        groupId: 'ID области: {{id}}',
        noDetails: 'Связей пока нет.',
        unsupportedTitle: 'Области доступа недоступны',
        unsupportedDescription:
          'Этот runtime не предоставляет маршруты областей учетных данных или моделей. Пользователи и клиентские ключи остаются видимыми без подстановки данных областей.',
        channelCreateTitle: 'Новая область учетных данных',
        modelCreateTitle: 'Новая область моделей',
        channelEditTitle: 'Изменить область учетных данных',
        modelEditTitle: 'Изменить область моделей',
        channelBindingTitle: 'Добавить связь учетных данных',
        modelBindingTitle: 'Добавить связь модели',
      },
      detail: {
        title: 'Детали пользователя',
        empty: 'Выберите пользователя для просмотра деталей.',
        passwordStored: 'Пароль сохранен',
        userId: 'ID пользователя: {{id}}',
        sections: {
          profile: 'Профиль',
          access: 'Область доступа',
        },
        fields: {
          id: 'ID',
          username: 'Username',
          createdAt: 'Создан',
          updatedAt: 'Обновлен',
          deletedAt: 'Удален',
          mfa: 'MFA',
          passkeyCount: 'Passkeys',
        },
      },
      toast: {
        userCreated: 'Пользователь создан.',
        userUpdated: 'Пользователь обновлен.',
        userDeleted: 'Пользователь удален.',
        keyCreated: 'Клиентский ключ создан.',
        keyUpdated: 'Доступ ключа обновлен.',
        keyDeleted: 'Клиентский ключ удален.',
        groupCreated: 'Область создана.',
        groupUpdated: 'Область обновлена.',
        groupDeleted: 'Область удалена.',
        bindingCreated: 'Связь добавлена.',
        bindingDeleted: 'Связь удалена.',
      },
      workspace: {
        title: 'Рабочая область доступа',
        description:
          'Управляйте пользователями, владельцами ключей, областями учетных данных и областями моделей в одном месте.',
        filterPlaceholder: 'Фильтр по пользователям, ключам или областям',
      },
      tabs: {
        users: 'Пользователи',
        keys: 'Клиентские ключи',
        channelGroups: 'Области учетных данных',
        modelGroups: 'Области моделей',
      },
      sheet: {
        userCreateDescription:
          'Создайте субъект доступа, которому можно назначать клиентские ключи. Пароль можно оставить пустым.',
        userEditDescription:
          'Username остается фиксированным после создания. Здесь обновляются только пароль и другие обслуживаемые поля.',
        userDetailDescription:
          'Просмотрите профиль пользователя, количество клиентских ключей и назначенные области доступа.',
        keyCreateDescription:
          'Создайте клиентский ключ доступа и при необходимости назначьте пользователя, области учетных данных и области моделей.',
        keyEditDescription:
          'Настройте владельца ключа и области доступа. Само значение ключа не меняется.',
        channelGroupCreateDescription:
          'Создайте область учетных данных, на которую могут ссылаться клиентские ключи.',
        modelGroupCreateDescription:
          'Создайте область моделей, на которую могут ссылаться клиентские ключи.',
        channelGroupEditDescription:
          'Измените название области учетных данных и состояние включения.',
        modelGroupEditDescription: 'Измените название области моделей и состояние включения.',
        channelBindingDescription:
          'Найдите и выберите учетные данные аккаунта для добавления в область. Связанные с областью клиентские ключи смогут использовать эти учетные данные.',
        modelBindingDescription:
          'Найдите и выберите модель для добавления в область. Связанные с областью клиентские ключи смогут использовать эти модели.',
      },
      delete: {
        title: 'Подтвердите удаление',
        user: 'Удалить пользователя "{{name}}"? Это не удалит глобальные учетные данные автоматически.',
        key: 'Удалить клиентский ключ {{name}}? Связанные клиенты сразу перестанут работать.',
        group: 'Удалить область "{{name}}"? Назначенные ключи потеряют ссылку на эту область.',
        detail: 'Удалить связь "{{name}}"?',
      },
    },
    configPage: {
      disconnected: {
        title: 'Подключите management runtime',
        description:
          'Системная конфигурация загружается из Management API. Подключите runtime перед чтением, изменением и сохранением.',
        action: 'Подключить runtime',
      },
      error: {
        title: 'Не удалось загрузить системную конфигурацию',
        description: 'Проверьте management endpoint, management key и маршруты конфигурации.',
        retry: 'Повторить',
      },
      header: {
        title: 'Рабочая область конфигурации',
        description:
          'Visual mode подходит для безопасных частых изменений. Config file mode полностью заменяет config.yaml.',
        runtime: 'Runtime: {{mode}}',
        updatedAt: 'Обновлено {{time}}',
      },
      modes: {
        label: 'Режим редактирования config',
        structured: 'Визуально',
        yaml: 'Файл config',
      },
      actions: {
        reload: 'Перезагрузить',
        save: 'Сохранить',
        viewChanges: 'Показать изменения',
        showSensitive: 'Показать чувствительное поле',
        hideSensitive: 'Скрыть чувствительное поле',
      },
      status: {
        clean: 'Нет несохраненных изменений',
        unsaved: 'Есть несохраненные изменения',
        visualChangeCount: 'Визуальных изменений: {{count}}',
        fileChanged: 'Файл config изменен',
        enabled: 'Включено',
        disabled: 'Выключено',
        emptyValue: 'пусто',
      },
      outline: {
        title: 'Разделы конфигурации',
      },
      sections: {
        server: {
          title: 'Runtime сервера',
          shortTitle: 'Сервер',
          description: 'Базовые переключатели для диагностики runtime и поведения сервиса.',
        },
        tls: {
          title: 'TLS',
          shortTitle: 'TLS',
          description:
            'Настройка HTTPS, пути сертификата и пути приватного ключа. Сохранение записывает изменения в config.yaml.',
        },
        remoteManagement: {
          title: 'Удаленное управление',
          shortTitle: 'Управление',
          description:
            'Управление удаленным доступом к Management API, management key и обновлением панели.',
        },
        authentication: {
          title: 'Аутентификация',
          shortTitle: 'Auth',
          description: 'Управление клиентской аутентификацией, включая WebSocket auth.',
        },
        oauthRules: {
          title: 'Правила моделей OAuth',
          shortTitle: 'OAuth rules',
          description:
            'Настройка исключенных моделей и клиентских алиасов для OAuth и file-backed credentials.',
        },
        system: {
          title: 'Журналы и usage',
          shortTitle: 'Журналы',
          description: 'Управление request logs, file logs, usage statistics и хранением журналов.',
        },
        network: {
          title: 'Сетевой proxy',
          shortTitle: 'Сеть',
          description: 'Настройка outbound proxy для запросов сервера.',
        },
        quota: {
          title: 'Обработка квот',
          shortTitle: 'Квоты',
          description: 'Поведение при исчерпании квоты.',
        },
        streaming: {
          title: 'Повторы и маршрутизация',
          shortTitle: 'Роутинг',
          description: 'Управление retry timing и маршрутизацией модельных сервисов.',
        },
        ampcode: {
          title: 'Amp CLI интеграция',
          shortTitle: 'Amp',
          description: 'Настройка upstream URL, key mappings и model mappings для Amp CLI.',
        },
        payload: {
          title: 'Payload rules',
          shortTitle: 'Payload',
          description:
            'Управление model prefix. Полные payload rules редактируются в режиме файла config.',
        },
      },
      fields: {
        debug: {
          label: 'Debug режим',
          description: 'Выводит больше runtime diagnostics. Используйте осторожно в production.',
        },
        loggingToFile: {
          label: 'Файловые журналы',
          description: 'Записывать журналы в файлы для долгосрочной диагностики.',
        },
        logsMaxTotalSizeMb: {
          label: 'Максимум журналов MB',
          description: 'Ограничение общего размера файлов журналов. 0 означает политику сервера.',
        },
        errorLogsMaxFiles: {
          label: 'Файлы error logs',
          description: 'Ограничение числа сохраняемых файлов error logs.',
        },
        usageStatisticsEnabled: {
          label: 'Статистика usage',
          description: 'Записывать usage по клиентским ключам и запросам.',
        },
        tlsEnable: {
          label: 'Включить HTTPS',
          description: 'Обслуживать внешний трафик по HTTPS с настроенным TLS сертификатом.',
        },
        tlsCert: {
          label: 'Путь сертификата',
          description: 'Путь к TLS certificate, соответствует tls.cert в config.yaml.',
          placeholder: '/path/to/cert.pem',
        },
        tlsKey: {
          label: 'Путь приватного ключа',
          description: 'Путь к TLS private key, соответствует tls.key в config.yaml.',
          placeholder: '/path/to/key.pem',
        },
        remoteManagementAllowRemote: {
          label: 'Разрешить remote management',
          description: 'Разрешить доступ к Management API не только с localhost.',
        },
        remoteManagementSecretKey: {
          label: 'Management key',
          description:
            'Ключ для management panel. В local config mode сервер обрабатывает plaintext keys при запуске.',
          placeholder: 'Введите management key',
        },
        remoteManagementDisableControlPanel: {
          label: 'Отключить control panel',
          description: 'Отключить /management.html и синхронизацию panel.',
        },
        remoteManagementDisableAutoUpdatePanel: {
          label: 'Отключить автообновление panel',
          description: 'Отключить периодические фоновые обновления panel assets.',
        },
        remoteManagementPanelGithubRepository: {
          label: 'Panel repository URL',
          description: 'GitHub repository URL или releases API URL для обновления panel assets.',
          placeholder: 'https://github.com/org/repo',
        },
        proxyUrl: {
          label: 'Outbound proxy URL',
          description:
            'Proxy URL для исходящих запросов сервера. Пустое значение удаляет настройку.',
          placeholder: 'http://127.0.0.1:7890',
        },
        requestLog: {
          label: 'Request log',
          description: 'Записывать request-level logs для диагностики.',
        },
        wsAuth: {
          label: 'WebSocket auth',
          description: 'Требовать аутентификацию для WebSocket подключений.',
        },
        requestRetry: {
          label: 'Повторы запросов',
          description: 'Количество повторов после ошибок запроса.',
        },
        maxRetryInterval: {
          label: 'Макс. интервал повтора',
          description: 'Верхняя граница ожидания перед повтором.',
        },
        forceModelPrefix: {
          label: 'Принудительный prefix модели',
          description: 'Применять правила model prefix к запрошенным именам моделей.',
        },
        routingStrategy: {
          label: 'Стратегия маршрутизации',
          description: 'Стратегия выбора при нескольких ключах или учетных данных.',
        },
        quotaSwitchProject: {
          label: 'Переключать проект при квоте',
          description: 'Пробовать другой проект при исчерпании квоты.',
        },
        quotaSwitchPreviewModel: {
          label: 'Переключать preview model при квоте',
          description: 'Пробовать доступную preview model при исчерпании квоты.',
        },
        ampcodeUpstreamUrl: {
          label: 'Amp upstream URL',
          description: 'Upstream URL для запросов Amp CLI. Пустое значение удаляет настройку.',
          placeholder: 'https://amp.example.com',
        },
        ampcodeUpstreamApiKey: {
          label: 'Amp upstream key',
          description: 'Один upstream Amp API key. Пустое значение удаляет настройку.',
          placeholder: 'Вставьте Amp upstream key',
        },
        ampcodeRestrictManagementToLocalhost: {
          label: 'Management только с localhost',
          description: 'Ограничить AmpCode management доступом с localhost.',
        },
        ampcodeForceModelMappings: {
          label: 'Принудительные model mappings',
          description: 'Принудительно применять model mappings ниже.',
        },
        ampcodeModelMappingsJson: {
          label: 'Model mappings',
          description:
            'Сопоставляет запрошенные Amp models с upstream target models, с optional regex matching.',
          placeholder: '[{"from":"claude-opus-4.5","to":"claude-sonnet-4","regex":false}]',
        },
        ampcodeUpstreamApiKeysJson: {
          label: 'Multiple upstream keys',
          description:
            'Сопоставляет client keys с конкретными Amp upstream keys для управления request forwarding.',
          placeholder: '[{"upstream-api-key":"upstream-key","api-keys":["client-key"]}]',
        },
        oauthExcludedModelsJson: {
          label: 'Disabled models',
          description:
            'Выберите auth channel и модели, которые нужно исключить из OAuth или file-backed credentials.',
          placeholder: '{"claude":["claude-opus-4.5"]}',
        },
        oauthModelAliasJson: {
          label: 'Model aliases',
          description:
            'Настройте client-visible model aliases по channel и сопоставьте их с upstream model names.',
          placeholder: '{"claude":[{"name":"claude-sonnet-4","alias":"sonnet","fork":true}]}',
        },
      },
      routingStrategies: {
        'round-robin': 'Round robin',
        'fill-first': 'Fill first',
        unknown: 'Неизвестно',
      },
      validation: {
        invalidField: 'Введите корректное значение.',
        jsonParseError: 'JSON не удалось разобрать: {{message}}',
        summary: 'Полей требуют внимания: {{count}}',
      },
      json: {
        remove: 'Удалить',
        unsupportedStructure:
          'Эта config содержит структуру, которую visual editor пока не поддерживает. Поддерживайте ее в config file mode.',
        emptyRows: 'Правила не настроены.',
        addProvider: 'Добавить provider',
        addChannel: 'Добавить channel',
        addAlias: 'Добавить alias',
        addMapping: 'Добавить mapping',
        addUpstreamKey: 'Добавить upstream key',
        removeChannel: 'Удалить channel',
        channelRuleCount: 'Правил: {{count}}',
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
          actions: 'Действия',
          upstreamApiKey: 'Upstream API key',
          clientKeys: 'Client keys',
        },
        columnDescriptions: {
          channel: 'Auth channel key, например claude, gemini или codex.',
          name: 'Model ID, который фактически отправляется upstream provider.',
          alias: 'Model alias, который может запросить клиент.',
          fork: 'Advanced option. API определяет это только как fork alias behavior; оставьте выключенным, если не нужно.',
          from: 'Amp model name в client request. При включенном Regex обрабатывается как regular expression.',
          to: 'Target upstream model name после совпадения.',
          regex:
            'Выключено: точное имя модели. Включено: requested model обрабатывается как regular expression.',
        },
        modelMappings: {
          description:
            'Переписывайте upstream models для Amp CLI по requested model. Включайте Regex только когда нужен pattern matching.',
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
        reloadModels: 'Перезагрузить модели',
        searchPlaceholder: 'Искать model ID, name или owner',
        selectedCount: 'Выбрано моделей: {{count}}',
        clearChannel: 'Очистить channel',
        emptyModels: 'Для этого channel не возвращены model definitions.',
        emptyFiltered: 'Нет подходящих моделей.',
        customTitle: 'Custom provider rules',
        customDescription:
          'Эти providers не входят в текущий visual channel list. Поддерживайте их в config file mode.',
        channels: {
          claude: 'Claude',
          gemini: 'Gemini',
          vertex: 'Vertex',
          'gemini-cli': 'Gemini CLI',
          aistudio: 'AI Studio',
          codex: 'Codex',
          kimi: 'Kimi',
          antigravity: 'Antigravity',
          xai: 'xAI',
        },
      },
      diff: {
        title: 'Изменения перед сохранением',
        empty: 'Нет изменений конфигурации для сохранения.',
        visualDescription:
          'В визуальном режиме есть несохраненные изменения: {{count}}. Нажмите на пункт, чтобы перейти к разделу конфигурации.',
        fileDescription:
          'Сохранение полностью перезапишет текущий config.yaml. Проверьте изменения.',
        fileChanged: 'Содержимое файла config изменено. Сохранение заменяет всю конфигурацию.',
        addedLines: 'Добавлено строк: {{count}}',
        removedLines: 'Удалено строк: {{count}}',
        omittedLines: 'Скрыто неизмененных строк: {{count}}',
      },
      yaml: {
        title: 'Config file mode',
        localWarning:
          'CPA и Home standalone читают и заменяют локальный config.yaml, обычно сохраняя комментарии и формат.',
        clusterWarning:
          'Home cluster записывает YAML в cluster config repository. Сервер может удалить credential roots и перекодировать config.',
        searchPlaceholder: 'Поиск в YAML',
        matches: 'Совпадений: {{count}}',
      },
      confirm: {
        reload: 'Отбросить несохраненные локальные изменения и перезагрузить?',
        saveYaml: 'Режим файла config заменяет всю конфигурацию. Сохранить?',
        switchMode:
          'В текущем режиме есть несохраненные изменения. Переключение режима отбросит их. Продолжить?',
      },
      confirmDialog: {
        switchModeTitle: 'Переключить режим редактирования?',
        reloadTitle: 'Перезагрузить конфигурацию?',
        saveYamlTitle: 'Сохранить полный файл config?',
        discardAndSwitch: 'Отбросить и переключить',
        discardAndReload: 'Отбросить и перезагрузить',
      },
      toast: {
        saved: 'Конфигурация сохранена.',
        validationFailed: 'Сначала исправьте ошибки валидации.',
      },
    },
    usageLogsPage: {
      disconnected: {
        title: 'Подключите management runtime',
        description:
          'Usage и logs загружаются из Management API. Подключите runtime, чтобы смотреть статистику запросов и журналы.',
        action: 'Подключить runtime',
      },
      error: {
        title: 'Не удалось загрузить usage и logs',
        description: 'Проверьте management endpoint, management key и маршруты журналов.',
        retry: 'Повторить',
      },
      header: {
        title: 'Usage & Logs',
        description:
          'Просмотр счетчиков запросов model services, API key usage, runtime logs и скачиваемых request error logs.',
        runtime: 'Runtime: {{mode}}',
        updatedAt: 'Последняя синхронизация: {{time}}',
      },
      actions: {
        refresh: 'Синхронизировать',
        syncing: 'Синхронизация',
        clearLogs: 'Очистить журналы',
        download: 'Скачать',
        downloadRequestLog: 'Скачать request log',
        viewLogDetail: 'Подробнее',
      },
      capabilities: {
        usage: 'Usage stats',
        logs: 'Runtime logs',
        requestErrorLogs: 'Error logs',
      },
      unavailable: {
        title: 'Этот runtime не предоставляет маршруты usage и logs',
        description:
          '{{mode}} не предоставляет runtime log или usage query routes. Страница показывает состояние capability без выдуманных данных.',
      },
      verdict: {
        ready: {
          title: 'Данные usage синхронизированы',
          badge: 'Можно анализировать',
          description:
            'Runtime вернул агрегаты API key usage для оценки объема запросов model services, ошибок и распределения по провайдерам.',
        },
        idle: {
          title: 'Usage statistics доступны, запросов пока нет',
          badge: 'Нет данных',
          description:
            'Runtime предоставляет usage routes, но не вернул строки API key usage. Синхронизируйте снова после обработки трафика.',
        },
        disabled: {
          title: 'Usage statistics отключены',
          badge: 'Отключено',
          description:
            'Runtime предоставляет usage routes, но usage-statistics-enabled отключен в config. Включите его для постоянной агрегации request usage.',
        },
        partial: {
          title: 'Данные usage синхронизированы частично',
          badge: 'Частично',
          description:
            'Страница продолжит показывать загруженные usage facts. Проверьте сбойные области перед полной оценкой.',
        },
        limited: {
          title: 'Данные usage ограничены',
          badge: 'Ограничено',
          description:
            '{{mode}} не вернул API key usage aggregates, поэтому для расследования доступны только logs и error files.',
        },
        unsupported: {
          title: 'Этот runtime не поддерживает usage routes',
          badge: 'Не поддерживается',
          description:
            '{{mode}} не открывает usage или log routes. Capability state остается видимым до появления backend observability APIs.',
        },
      },
      issues: {
        title: 'Часть данных не загрузилась',
      },
      issueScopes: {
        apiKeyUsage: 'Usage stats',
        logs: 'Runtime logs',
        requestErrorLogs: 'Error logs',
        clearLogs: 'Очистить журналы',
      },
      summary: {
        keys: 'Usage keys',
        keysDetail: 'Окон recent requests: {{count}}',
        requests: 'Запросов',
        requestsDetail: '{{success}} успешно / {{failed}} с ошибкой',
        logs: 'Runtime logs',
        logsDetail: 'Файлов error logs: {{count}}',
      },
      usage: {
        title: 'API key usage',
        description:
          'Группирует успешные и ошибочные запросы по model provider, upstream Base URL и API key.',
        unavailable: 'Текущий runtime не предоставляет API key usage.',
        empty:
          'API key usage records не возвращены. Проверьте, что usage statistics включены и runtime уже обрабатывал запросы.',
        provider: 'Провайдер модели',
        baseUrl: 'Base URL',
        key: 'Ключ',
        success: 'Успешно',
        failed: 'Ошибки',
        recentWindows: 'Recent windows',
      },
      operations: {
        title: 'Logs и инструменты расследования',
        description:
          'Runtime logs и error logs помогают разбирать цепочку запроса, состояние runtime и ошибочные ответы.',
      },
      logs: {
        title: 'Runtime logs',
        description:
          'Показывает runtime logs постранично. В таблице видна сводка; полное содержимое и метаданные запроса доступны в деталях.',
        unavailable: 'Этот runtime не предоставляет маршрут runtime logs.',
        empty:
          'Нет строк runtime log для отображения. Проверьте, что file logging включен и runtime уже записывал журналы.',
        emptyPage: 'На этой странице нет записей. Вернитесь назад или синхронизируйте данные.',
        lineCount: '{{count}} строк',
        latest: 'Последнее время: {{time}}',
        latestUnavailable: 'Последнее время недоступно',
        total: 'Всего: {{count}}',
        range: 'Показано {{start}}-{{end}} из {{total}}',
        columns: {
          time: 'Время',
          level: 'Уровень',
          request: 'Request ID',
          homeIp: 'Home IP',
          clientIp: 'Client IP',
          line: 'Строка журнала',
          summary: 'Сводка',
          actions: 'Действия',
        },
        pagination: {
          range: '{{start}}-{{end}} из {{total}}',
          pageSize: 'Строк',
          previous: 'Назад',
          next: 'Вперед',
        },
        detail: {
          title: 'Детали журнала',
          createdAt: 'Создано',
          content: 'Содержимое журнала',
          requestLogUnavailable: 'Для этой записи нет доступного request log.',
        },
      },
      errorLogs: {
        title: 'Файлы error logs',
        description:
          'Показывает файлы error-*.log, созданные при выключенном request logging, и позволяет скачать файл.',
        unavailable: 'Этот runtime не предоставляет маршрут файлов error logs.',
        empty: 'Файлы error logs не возвращены.',
        meta: '{{size}} bytes · {{time}}',
        searchPlaceholder: 'Искать имя log file, нажмите Enter',
        columns: {
          name: 'Журнал',
          modified: 'Обновлено',
          size: 'Размер',
          actions: 'Действия',
        },
      },
      status: {
        success: 'Успешно',
        failed: 'Ошибка',
        notAvailable: 'Н/Д',
        unknownRequest: 'Неизвестный запрос',
        localHome: 'Локальный Home',
      },
      confirm: {
        clearLogsTitle: 'Очистить runtime logs?',
        clearLogs:
          'Очистить runtime logs? Это удалит ротированные файлы и обрежет активный журнал.',
      },
      toast: {
        logsCleared: 'Журналы очищены.',
        logDownloaded: 'Журнал скачан.',
      },
    },
    systemNodesPage: {
      disconnected: {
        title: 'Подключите management runtime',
        description:
          'Данные runtime и диагностики загружаются из Management API. Подключите runtime, чтобы смотреть версии, сводку конфигурации, узлы и диагностические инструменты.',
        action: 'Подключить runtime',
      },
      error: {
        title: 'Не удалось загрузить runtime и диагностику',
        description:
          'Проверьте management endpoint, management key и маршруты системной диагностики.',
        retry: 'Повторить',
      },
      header: {
        title: 'Runtime и диагностика',
        runtime: 'Runtime: {{mode}}',
        probedAt: 'Capabilities проверены: {{time}}',
        updatedAt: 'Последняя синхронизация: {{time}}',
      },
      actions: {
        refresh: 'Синхронизировать',
        syncing: 'Синхронизация',
        openDiagnostics: 'Диагностика',
      },
      verdict: {
        ready: {
          title: 'Системная информация синхронизирована',
          badge: 'Норма',
          description:
            'Версия, конфигурация и состояние подключений узлов синхронизированы для оценки текущего runtime.',
        },
        limited: {
          title: 'Системная информация синхронизирована',
          badge: 'Узлы недоступны',
          description:
            'Этот runtime не предоставляет маршрут запроса узлов. Используйте версию и сводку конфигурации как основные сигналы.',
        },
        degraded: {
          title: 'Системная информация синхронизирована частично',
          badge: 'Частичный сбой',
          description:
            'Страница продолжит показывать загруженную информацию. Исправьте сбои перед полной оценкой.',
        },
        unavailable: {
          title: 'Системная информация недоступна',
          badge: 'Недоступно',
          description:
            'Ключевые диагностические маршруты не вернули пригодные данные. Проверьте Management API, management key и диагностические возможности runtime.',
        },
        facts: {
          config: 'Сводка конфигурации: {{status}}',
          version: 'Информация о версии: {{status}}',
          nodes: 'Записи узлов: {{count}}',
          nodesUnsupported: 'Маршрут узлов: недоступен',
          issues: 'Ошибки загрузки: {{count}}',
          noIssues: 'Нет ошибок загрузки',
        },
      },
      config: {
        empty: 'Сводка конфигурации не возвращена.',
        title: 'Сводка конфигурации сервиса',
        fields: {
          debug: 'Debug mode',
          requestLog: 'Журналы запросов',
          usageStatistics: 'Статистика usage',
          loggingToFile: 'Запись в файл',
          proxyConfigured: 'Proxy endpoint',
          routingStrategy: 'Стратегия маршрутизации',
        },
      },
      status: {
        enabled: 'Включено',
        disabled: 'Отключено',
        connected: 'Подключено',
        notAvailable: 'Н/Д',
        unknown: 'Неизвестно',
        available: 'Доступно',
      },
      nodes: {
        title: 'Подключения узлов',
        addNode: 'Добавить узел',
        unavailable: 'Текущий runtime {{runtime}} не предоставляет маршрут запроса узлов.',
        empty: 'Записи подключений узлов не возвращены.',
        emptySupported: 'Маршрут узлов доступен, но записи подключений не возвращены.',
        connectedTime: 'Подключено: {{time}}',
        enrollment: {
          title: 'Токен подключения узла',
          description:
            'Настройте учётные данные на узле, который нужно подключить. Сохраните их: после закрытия панели их нужно создавать заново.',
          clientId: 'ID клиента',
          jwtLabel: 'Учётные данные',
          copyJwt: 'Копировать учётные данные',
          copied: 'Скопировано',
        },
      },
      issues: {
        title: 'Часть диагностических данных не загрузилась',
      },
      issueScopes: {
        latestVersion: 'Последняя версия',
        config: 'Сводка конфигурации',
        nodes: 'Подключения узлов',
        apiCall: 'Диагностический запрос',
      },
      apiCall: {
        title: 'Диагностический запрос Management API',
        description:
          'Отправляет один upstream-запрос с сервера для диагностики подключения, учетных данных или upstream API.',
        riskTitle: 'Диагностическое действие с повышенными правами',
        warning:
          'Инструмент отправляет один upstream-запрос с сервера. Используйте его только для диагностики подключения, учетных данных или upstream API. Не отправляйте production-sensitive данные.',
        method: 'Метод',
        url: 'Target URL',
        urlPlaceholder: 'https://api.example.com/v1/ping',
        authIndex: 'Индекс учетных данных',
        authIndexPlaceholder:
          'Необязательно, пустое значение использует учетные данные по умолчанию',
        headers: 'Headers JSON',
        body: 'Body',
        bodyPlaceholder: 'Необязательно, тело отправляется как введено',
        validation: {
          urlRequired: 'Введите target URL.',
          headersJsonInvalid: 'Headers должны быть валидным JSON.',
          headersObjectRequired: 'Headers JSON должен быть объектом.',
        },
        run: 'Отправить диагностический запрос',
        responseStatus: 'Статус ответа: {{status}}',
      },
      summary: {
        version: 'Версия сервиса',
        latestVersion: 'Последняя версия: {{version}}',
        nodes: 'Узлы',
        nodesAvailable: 'Маршрут узлов доступен',
        nodesEmpty: 'Маршрут узлов доступен, записей подключений пока нет',
        nodesConnected: 'Возвращено узлов: {{count}}',
        nodesUnavailable: 'Этот runtime не предоставляет запросы nodes',
        config: 'Сводка конфигурации',
        configAvailable: 'Сводка конфигурации runtime загружена',
        configUnavailable: 'Маршрут сводки конфигурации не вернул пригодные данные',
        apiCall: 'API диагностика',
        apiCallDetail: 'Используйте /api-call для проверки upstream connectivity',
      },
      toast: {
        apiCallComplete: 'Диагностический запрос завершен.',
        nodeClientCreated: 'Клиент узла создан.',
        nodeJwtCopied: 'Учётные данные скопированы в буфер обмена.',
      },
    },
    placeholder: {
      phase: 'Каркас Phase 0',
      dashboard: {
        title: 'Панель',
        description:
          'Главная страница коммерческой консоли будет объединять состояние runtime, покрытие провайдеров, учетные данные, ключи доступа, узлы и версии.',
        itemOne:
          'Читать GET /config, GET /latest-version, GET /auth-files, GET-маршруты провайдеров и GET /nodes, если доступно.',
        itemTwo:
          'Показывать обзор состояния с учетом capability для CPA, Home standalone и Home cluster.',
      },
      providers: {
        title: 'Провайдеры',
        description:
          'Ключи провайдеров будут управляться как рабочая область с группировкой, таблицами, панелями редактирования, определениями моделей и нормализованными идентификаторами.',
        itemOne: 'Покрыть маршруты Gemini, Claude, Codex, Vertex и OpenAI-compatible провайдеров.',
        itemTwo:
          'Нормализовать auth-index, auth_index, id, uuid, disabled и различия полей через adapters.',
      },
      credentials: {
        title: 'Учетные данные',
        description:
          'OAuth и file-backed credentials будут управляться как ресурсная рабочая область со статусами, редактированием metadata, загрузкой, выгрузкой и OAuth handoff.',
        itemOne:
          'Использовать GET /auth-files, а также маршруты status, fields, upload, download, models, OAuth и Vertex import.',
        itemTwo:
          'Обрабатывать источники file, memory и db без предположения о локальных путях в cluster режиме.',
      },
      accessKeys: {
        title: 'Ключи доступа',
        description:
          'Клиентские API keys будут управляться отдельно от ключей upstream providers, с маскированным отображением и отдельными сценариями создания, редактирования и удаления.',
        itemOne: 'Использовать GET, PUT, PATCH и DELETE /api-keys.',
        itemTwo:
          'Не предполагать server-side metadata за пределами документированного массива ключей.',
      },
      config: {
        title: 'Конфигурация',
        description:
          'Конфигурация будет иметь структурированный режим для частых настроек и YAML-режим для полной замены с сообщениями сохранения по режиму.',
        itemOne:
          'Использовать GET /config, GET /config.yaml, PUT /config.yaml и простые leaf routes.',
        itemTwo:
          'Предупреждать, что cluster режим переписывает YAML из состояния repository и не сохраняет комментарии.',
      },
      usageLogs: {
        title: 'Использование и журналы',
        description:
          'Использование и журналы будут capability-aware аналитическими страницами, которые корректно деградируют, если Home cluster не предоставляет runtime log routes.',
        itemOne:
          'Использовать GET /api-key-usage, GET /logs, DELETE /logs и request error log routes, если доступно.',
        itemTwo:
          'Показывать состояние недоступности вместо ошибки страницы при отсутствующих cluster routes.',
      },
      systemNodes: {
        title: 'Сведения о системе',
        description:
          'Страница сведений о системе покажет версию runtime, состояние подключения, подключение узлов, выбранную диагностику и защищенные инструменты Management API.',
        itemOne:
          'Использовать GET /nodes, GET /latest-version, GET /config, leaf routes и защищенный POST /api-call.',
        itemTwo:
          'Показывать высокопривилегированные диагностические вызовы только с явным предупреждением.',
      },
    },
  },
}
