/**
 * ODAG Language Support
 * Multilingual message definitions for the extension
 *
 * @version 6.0.0
 */

define([], function() {
    'use strict';

    /**
     * Language Messages
     * Supports: English, Turkish, Spanish, Chinese (Simplified), Arabic
     */
    const LANGUAGES = {
        en: {
            // View Mode
            viewMode: {
                list: 'List View',
                dynamic: 'Dynamic View'
            },

            // Button Labels
            buttons: {
                generate: 'Generate ODAG App',
                refresh: 'Refresh',
                cancel: 'Cancel',
                delete: 'Delete',
                deleteAll: 'Delete All Apps',
                open: 'Open in new tab',
                reload: 'Reload data',
                close: 'Close'
            },

            // Status Messages
            status: {
                queued: 'Queued',
                generating: 'Generating',
                validating: 'Validating',
                ready: 'Ready',
                failed: 'Failed',
                cancelled: 'Cancelled',
                loading: 'Loading...',
                noApps: 'No ODAG apps generated yet',
                fetchingApps: 'Fetching ODAG apps...'
            },

            // Progress Messages
            progress: {
                generatingApp: 'Generating ODAG app...',
                loadingApp: 'Loading app...',
                deletingApp: 'Deleting app...',
                deletingAll: 'Deleting all apps...',
                cancellingGeneration: 'Cancelling generation...',
                reloadingApp: 'Reloading app...'
            },

            // Validation Messages
            validation: {
                noOdagLink: 'Please configure ODAG Link ID in properties',
                invalidLinkId: 'Invalid ODAG Link ID format',
                selectionRequired: 'Please make required selections',
                rowLimitExceeded: 'Selection exceeds row limit',
                appLimitReached: 'App generation limit reached. Please delete old apps.',
                bindingNotFound: 'Required binding fields not found'
            },

            // Warning Messages
            warnings: {
                selectionsChanged: 'Your selections have changed',
                stateChanged: 'State has changed - click refresh to generate new app',
                oldAppExists: 'Old app will be deleted when new app is ready',
                mobileNotSupported: 'Dynamic View is not supported on mobile. Showing List View instead.'
            },

            // Error Messages
            errors: {
                loadFailed: 'Loading failed',
                generationFailed: 'Generation failed',
                generationTimeout: 'Generation timed out. Please try again.',
                deleteFailed: 'Delete failed',
                cancelFailed: 'Cancel failed',
                reloadFailed: 'Reload failed',
                apiError: 'API request failed',
                errorLoadingApps: 'Error loading apps',
                accessDenied: 'Access denied',
                unknownError: 'An unknown error occurred'
            },

            // Success Messages
            success: {
                generated: 'App generated successfully',
                deleted: 'App deleted successfully',
                cancelled: 'Generation cancelled',
                reloaded: 'App reload triggered'
            },

            // Info Messages
            info: {
                selectApp: 'Select an app from the list',
                noBindings: 'No binding fields configured',
                requiredFields: 'Required Binding Fields',
                optionalFields: 'Optional Binding Fields',
                appCount: 'apps',
                generatedOn: 'Generated on',
                lastReloaded: 'Last reloaded',
                generatedApps: 'Generated Apps',
                initializing: 'Initializing Dynamic View...',
                actions: 'Actions'
            }
        },

        tr: {
            // View Mode
            viewMode: {
                list: 'Liste Görünümü',
                dynamic: 'Dinamik Görünüm'
            },

            // Button Labels
            buttons: {
                generate: 'ODAG Uygulaması Oluştur',
                refresh: 'Yenile',
                cancel: 'İptal',
                delete: 'Sil',
                deleteAll: 'Tüm Uygulamaları Sil',
                open: 'Yeni sekmede aç',
                reload: 'Veriyi yeniden yükle',
                close: 'Kapat'
            },

            // Status Messages
            status: {
                queued: 'Sırada',
                generating: 'Oluşturuluyor',
                validating: 'Doğrulanıyor',
                ready: 'Hazır',
                failed: 'Başarısız',
                cancelled: 'İptal Edildi',
                loading: 'Yükleniyor...',
                noApps: 'Henüz ODAG uygulaması oluşturulmadı',
                fetchingApps: 'ODAG uygulamaları getiriliyor...'
            },

            // Progress Messages
            progress: {
                generatingApp: 'ODAG uygulaması oluşturuluyor...',
                loadingApp: 'Uygulama yükleniyor...',
                deletingApp: 'Uygulama siliniyor...',
                deletingAll: 'Tüm uygulamalar siliniyor...',
                cancellingGeneration: 'Oluşturma iptal ediliyor...',
                reloadingApp: 'Uygulama yeniden yükleniyor...'
            },

            // Validation Messages
            validation: {
                noOdagLink: 'Lütfen özellikler panelinde ODAG Link ID yapılandırın',
                invalidLinkId: 'Geçersiz ODAG Link ID formatı',
                selectionRequired: 'Lütfen gerekli seçimleri yapın',
                rowLimitExceeded: 'Seçim satır limitini aşıyor',
                appLimitReached: 'Uygulama oluşturma limiti doldu. Lütfen eski uygulamaları silin.',
                bindingNotFound: 'Gerekli bağlama alanları bulunamadı'
            },

            // Warning Messages
            warnings: {
                selectionsChanged: 'Seçimleriniz değişti',
                stateChanged: 'Durum değişti - yeni uygulama oluşturmak için yenile\'ye tıklayın',
                oldAppExists: 'Eski uygulama, yeni uygulama hazır olduğunda silinecek',
                mobileNotSupported: 'Dinamik Görünüm mobilde desteklenmiyor. Liste Görünümü gösteriliyor.'
            },

            // Error Messages
            errors: {
                loadFailed: 'Yükleme başarısız',
                generationFailed: 'Oluşturma başarısız',
                generationTimeout: 'Oluşturma zaman aşımına uğradı. Lütfen tekrar deneyin.',
                deleteFailed: 'Silme başarısız',
                cancelFailed: 'İptal başarısız',
                reloadFailed: 'Yeniden yükleme başarısız',
                apiError: 'API isteği başarısız',
                errorLoadingApps: 'Uygulamalar yüklenirken hata',
                accessDenied: 'Erişim reddedildi',
                unknownError: 'Bilinmeyen bir hata oluştu'
            },

            // Success Messages
            success: {
                generated: 'Uygulama başarıyla oluşturuldu',
                deleted: 'Uygulama başarıyla silindi',
                cancelled: 'Oluşturma iptal edildi',
                reloaded: 'Uygulama yeniden yükleme tetiklendi'
            },

            // Info Messages
            info: {
                selectApp: 'Listeden bir uygulama seçin',
                noBindings: 'Bağlama alanı yapılandırılmadı',
                requiredFields: 'Gerekli Bağlama Alanları',
                optionalFields: 'İsteğe Bağlı Alanlar',
                appCount: 'uygulama',
                generatedOn: 'Oluşturulma',
                lastReloaded: 'Son yenileme',
                generatedApps: 'Oluşturulan Uygulamalar',
                initializing: 'Dinamik Görünüm başlatılıyor...',
                actions: 'İşlemler'
            }
        },

        es: {
            // View Mode
            viewMode: {
                list: 'Vista de Lista',
                dynamic: 'Vista Dinámica'
            },

            // Button Labels
            buttons: {
                generate: 'Generar Aplicación ODAG',
                refresh: 'Actualizar',
                cancel: 'Cancelar',
                delete: 'Eliminar',
                deleteAll: 'Eliminar Todas las Apps',
                open: 'Abrir en nueva pestaña',
                reload: 'Recargar datos',
                close: 'Cerrar'
            },

            // Status Messages
            status: {
                queued: 'En Cola',
                generating: 'Generando',
                validating: 'Validando',
                ready: 'Listo',
                failed: 'Fallido',
                cancelled: 'Cancelado',
                loading: 'Cargando...',
                noApps: 'No se han generado aplicaciones ODAG todavía',
                fetchingApps: 'Obteniendo aplicaciones ODAG...'
            },

            // Progress Messages
            progress: {
                generatingApp: 'Generando aplicación ODAG...',
                loadingApp: 'Cargando aplicación...',
                deletingApp: 'Eliminando aplicación...',
                deletingAll: 'Eliminando todas las aplicaciones...',
                cancellingGeneration: 'Cancelando generación...',
                reloadingApp: 'Recargando aplicación...'
            },

            // Validation Messages
            validation: {
                noOdagLink: 'Por favor configure el ID de enlace ODAG en propiedades',
                invalidLinkId: 'Formato de ID de enlace ODAG inválido',
                selectionRequired: 'Por favor realice las selecciones requeridas',
                rowLimitExceeded: 'La selección excede el límite de filas',
                appLimitReached: 'Límite de generación de aplicaciones alcanzado. Elimine aplicaciones antiguas.',
                bindingNotFound: 'Campos de vinculación requeridos no encontrados'
            },

            // Warning Messages
            warnings: {
                selectionsChanged: 'Sus selecciones han cambiado',
                stateChanged: 'El estado ha cambiado - haga clic en actualizar para generar nueva aplicación',
                oldAppExists: 'La aplicación antigua se eliminará cuando la nueva esté lista',
                mobileNotSupported: 'Vista Dinámica no está soportada en móvil. Mostrando Vista de Lista.'
            },

            // Error Messages
            errors: {
                loadFailed: 'Carga fallida',
                generationFailed: 'Generación fallida',
                generationTimeout: 'Tiempo de generación agotado. Inténtalo de nuevo.',
                deleteFailed: 'Eliminación fallida',
                cancelFailed: 'Cancelación fallida',
                reloadFailed: 'Recarga fallida',
                apiError: 'Solicitud API fallida',
                errorLoadingApps: 'Error al cargar aplicaciones',
                accessDenied: 'Acceso denegado',
                unknownError: 'Ocurrió un error desconocido'
            },

            // Success Messages
            success: {
                generated: 'Aplicación generada exitosamente',
                deleted: 'Aplicación eliminada exitosamente',
                cancelled: 'Generación cancelada',
                reloaded: 'Recarga de aplicación activada'
            },

            // Info Messages
            info: {
                selectApp: 'Seleccione una aplicación de la lista',
                noBindings: 'No hay campos de vinculación configurados',
                requiredFields: 'Campos de Vinculación Requeridos',
                optionalFields: 'Campos Opcionales',
                appCount: 'aplicaciones',
                generatedOn: 'Generado el',
                lastReloaded: 'Última recarga',
                generatedApps: 'Aplicaciones Generadas',
                initializing: 'Inicializando Vista Dinámica...',
                actions: 'Acciones'
            }
        },

        zh: {
            // View Mode
            viewMode: {
                list: '列表视图',
                dynamic: '动态视图'
            },

            // Button Labels
            buttons: {
                generate: '生成 ODAG 应用',
                refresh: '刷新',
                cancel: '取消',
                delete: '删除',
                deleteAll: '删除所有应用',
                open: '在新标签页中打开',
                reload: '重新加载数据',
                close: '关闭'
            },

            // Status Messages
            status: {
                queued: '排队中',
                generating: '生成中',
                validating: '验证中',
                ready: '就绪',
                failed: '失败',
                cancelled: '已取消',
                loading: '加载中...',
                noApps: '尚未生成 ODAG 应用',
                fetchingApps: '正在获取 ODAG 应用...'
            },

            // Progress Messages
            progress: {
                generatingApp: '正在生成 ODAG 应用...',
                loadingApp: '正在加载应用...',
                deletingApp: '正在删除应用...',
                deletingAll: '正在删除所有应用...',
                cancellingGeneration: '正在取消生成...',
                reloadingApp: '正在重新加载应用...'
            },

            // Validation Messages
            validation: {
                noOdagLink: '请在属性中配置 ODAG 链接 ID',
                invalidLinkId: 'ODAG 链接 ID 格式无效',
                selectionRequired: '请进行必需的选择',
                rowLimitExceeded: '选择超出行数限制',
                appLimitReached: '已达到应用生成限制。请删除旧应用。',
                bindingNotFound: '未找到必需的绑定字段'
            },

            // Warning Messages
            warnings: {
                selectionsChanged: '您的选择已更改',
                stateChanged: '状态已更改 - 点击刷新以生成新应用',
                oldAppExists: '新应用就绪时将删除旧应用',
                mobileNotSupported: '移动设备不支持动态视图。显示列表视图。'
            },

            // Error Messages
            errors: {
                loadFailed: '加载失败',
                generationFailed: '生成失败',
                generationTimeout: '生成超时。请重试。',
                deleteFailed: '删除失败',
                cancelFailed: '取消失败',
                reloadFailed: '重新加载失败',
                apiError: 'API 请求失败',
                errorLoadingApps: '加载应用时出错',
                accessDenied: '访问被拒绝',
                unknownError: '发生未知错误'
            },

            // Success Messages
            success: {
                generated: '应用生成成功',
                deleted: '应用删除成功',
                cancelled: '生成已取消',
                reloaded: '应用重新加载已触发'
            },

            // Info Messages
            info: {
                selectApp: '从列表中选择一个应用',
                noBindings: '未配置绑定字段',
                requiredFields: '必需的绑定字段',
                optionalFields: '可选字段',
                appCount: '应用',
                generatedOn: '生成于',
                lastReloaded: '最后重新加载',
                generatedApps: '已生成的应用',
                initializing: '正在初始化动态视图...',
                actions: '操作'
            }
        },

        ar: {
            // View Mode
            viewMode: {
                list: 'عرض القائمة',
                dynamic: 'العرض الديناميكي'
            },

            // Button Labels
            buttons: {
                generate: 'إنشاء تطبيق ODAG',
                refresh: 'تحديث',
                cancel: 'إلغاء',
                delete: 'حذف',
                deleteAll: 'حذف جميع التطبيقات',
                open: 'فتح في علامة تبويب جديدة',
                reload: 'إعادة تحميل البيانات',
                close: 'إغلاق'
            },

            // Status Messages
            status: {
                queued: 'في الانتظار',
                generating: 'جاري الإنشاء',
                validating: 'جاري التحقق',
                ready: 'جاهز',
                failed: 'فشل',
                cancelled: 'تم الإلغاء',
                loading: 'جاري التحميل...',
                noApps: 'لم يتم إنشاء تطبيقات ODAG بعد',
                fetchingApps: 'جاري جلب تطبيقات ODAG...'
            },

            // Progress Messages
            progress: {
                generatingApp: 'جاري إنشاء تطبيق ODAG...',
                loadingApp: 'جاري تحميل التطبيق...',
                deletingApp: 'جاري حذف التطبيق...',
                deletingAll: 'جاري حذف جميع التطبيقات...',
                cancellingGeneration: 'جاري إلغاء الإنشاء...',
                reloadingApp: 'جاري إعادة تحميل التطبيق...'
            },

            // Validation Messages
            validation: {
                noOdagLink: 'يرجى تكوين معرف رابط ODAG في الخصائص',
                invalidLinkId: 'تنسيق معرف رابط ODAG غير صالح',
                selectionRequired: 'يرجى إجراء التحديدات المطلوبة',
                rowLimitExceeded: 'يتجاوز التحديد حد الصفوف',
                appLimitReached: 'تم الوصول إلى حد إنشاء التطبيقات. يرجى حذف التطبيقات القديمة.',
                bindingNotFound: 'لم يتم العثور على حقول الربط المطلوبة'
            },

            // Warning Messages
            warnings: {
                selectionsChanged: 'تغيرت اختياراتك',
                stateChanged: 'تغيرت الحالة - انقر فوق تحديث لإنشاء تطبيق جديد',
                oldAppExists: 'سيتم حذف التطبيق القديم عندما يكون التطبيق الجديد جاهزًا',
                mobileNotSupported: 'العرض الديناميكي غير مدعوم على الجوال. عرض قائمة بدلاً من ذلك.'
            },

            // Error Messages
            errors: {
                loadFailed: 'فشل التحميل',
                generationFailed: 'فشل الإنشاء',
                generationTimeout: 'انتهت مهلة الإنشاء. يرجى المحاولة مرة أخرى.',
                deleteFailed: 'فشل الحذف',
                cancelFailed: 'فشل الإلغاء',
                reloadFailed: 'فشلت إعادة التحميل',
                apiError: 'فشل طلب API',
                errorLoadingApps: 'خطأ في تحميل التطبيقات',
                accessDenied: 'تم رفض الوصول',
                unknownError: 'حدث خطأ غير معروف'
            },

            // Success Messages
            success: {
                generated: 'تم إنشاء التطبيق بنجاح',
                deleted: 'تم حذف التطبيق بنجاح',
                cancelled: 'تم إلغاء الإنشاء',
                reloaded: 'تم تشغيل إعادة تحميل التطبيق'
            },

            // Info Messages
            info: {
                selectApp: 'حدد تطبيقًا من القائمة',
                noBindings: 'لم يتم تكوين حقول الربط',
                requiredFields: 'حقول الربط المطلوبة',
                optionalFields: 'الحقول الاختيارية',
                appCount: 'تطبيقات',
                generatedOn: 'تم الإنشاء في',
                lastReloaded: 'آخر إعادة تحميل',
                generatedApps: 'التطبيقات المُنشأة',
                initializing: 'جارٍ تهيئة العرض الديناميكي...',
                actions: 'الإجراءات'
            }
        }
    };

    /**
     * Get messages for specific language
     * @param {string} languageCode - Language code (en, tr, es, zh, ar)
     * @returns {Object} Message object for the language
     */
    function getMessages(languageCode) {
        return LANGUAGES[languageCode] || LANGUAGES.en;
    }

    /**
     * Get list of available languages
     * @returns {Array} Array of language options
     */
    function getLanguageOptions() {
        return [
            { value: 'en', label: 'English' },
            { value: 'tr', label: 'Türkçe' },
            { value: 'es', label: 'Español' },
            { value: 'zh', label: '中文' },
            { value: 'ar', label: 'العربية' }
        ];
    }

    return {
        LANGUAGES: LANGUAGES,
        getMessages: getMessages,
        getLanguageOptions: getLanguageOptions
    };
});
