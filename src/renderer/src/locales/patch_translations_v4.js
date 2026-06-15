const fs = require('fs');
const path = require('path');

const localesDir = path.join('c:/Users/DEDE-/Desktop/Elektronik Yevmiye Defteri/src/renderer/src/locales');

const patchData = {
  tr: {
    dashboard: {
      delete_worker_title: "Personeli Sil",
      delete_worker_msg: "Bu personeli silmek (çöp kutusuna taşımak) istediğinize emin misiniz? Sistemdeki verileri kalıcı olarak silinmez, ancak listelerden kaldırılır."
    },
    common: { required_field: "Lütfen bu alanı doldurun." },
    recycle: {
      restore_confirm_title: "Geri Yükleme Onayı",
      restore_confirm_msg: "Bu kaydı geri yüklemek istediğinize emin misiniz? Kayıt, silinmeden önceki asıl yerine eklenecektir.",
      restore_error: "Geri yükleme hatası:"
    },
    journal: {
      weather_not_found: "Belirtilen konum bulunamadı: \"{{location}}\". Lütfen il/ilçe adını kontrol edin.",
      weather_unauthorized: "Hava durumu API anahtarı geçersiz veya süresi dolmuş. Lütfen Ayarlar sayfasından güncelleyin.",
      weather_offline: "İnternet bağlantısı yok veya hava durumu servisine ulaşılamıyor.",
      weather_api_error: "Hava durumu servisi hata döndürdü."
    },
    materials: {
      upload_mobile_title: "Mobil Fotoğraf Yükle",
      upload_mobile_desc: "Telefonunuzu ve bilgisayarınızı **aynı WiFi ağına** bağlayın, ardından QR kodu kameranızla taratın:"
    }
  },
  en: {
    dashboard: {
      delete_worker_title: "Delete Personnel",
      delete_worker_msg: "Are you sure you want to delete this personnel (move to recycle bin)? System data will not be permanently deleted, but removed from lists."
    },
    common: { required_field: "Please fill out this field." },
    recycle: {
      restore_confirm_title: "Restore Confirmation",
      restore_confirm_msg: "Are you sure you want to restore this record? It will be moved back to its original location.",
      restore_error: "Restore error:"
    },
    journal: {
      weather_not_found: "Specified location not found: \"{{location}}\". Please check the city/district name.",
      weather_unauthorized: "Weather API key is invalid or expired. Please update it in Settings.",
      weather_offline: "No internet connection or weather service is unreachable.",
      weather_api_error: "Weather service returned an error."
    },
    materials: {
      upload_mobile_title: "Upload Photo from Mobile",
      upload_mobile_desc: "Connect your mobile to the **same WiFi network** and scan the QR code:"
    }
  },
  es: {
    dashboard: {
      delete_worker_title: "Eliminar Personal",
      delete_worker_msg: "¿Estás seguro de que quieres eliminar este personal (mover a la papelera)? Los datos del sistema no se eliminarán permanentemente, pero se quitarán de las listas."
    },
    common: { required_field: "Por favor, complete este campo." },
    recycle: {
      restore_confirm_title: "Confirmación de Restauración",
      restore_confirm_msg: "¿Estás seguro de que deseas restaurar este registro? Se moverá de vuelta a su ubicación original.",
      restore_error: "Error de restauración:"
    },
    journal: {
      weather_not_found: "Ubicación especificada no encontrada: \"{{location}}\". Verifique el nombre de la ciudad.",
      weather_unauthorized: "La clave API del clima no es válida o ha caducado. Actualícela en Configuración.",
      weather_offline: "Sin conexión a internet o el servicio meteorológico no está disponible.",
      weather_api_error: "El servicio meteorológico devolvió un error."
    },
    materials: {
      upload_mobile_title: "Subir Foto desde Móvil",
      upload_mobile_desc: "Conecte el móvil a la **misma red WiFi** y escanee el QR:"
    }
  },
  ar: {
    dashboard: {
      delete_worker_title: "حذف الموظف",
      delete_worker_msg: "هل أنت متأكد أنك تريد حذف هذا الموظف (النقل إلى سلة المهملات)؟ لن يتم حذف بيانات النظام نهائيًا، بل ستتم إزالتها من القوائم فقط."
    },
    common: { required_field: "يرجى ملء هذا الحقل." },
    recycle: {
      restore_confirm_title: "تأكيد الاستعادة",
      restore_confirm_msg: "هل أنت متأكد أنك تريد استعادة هذا السجل؟ سيتم إرجاعه إلى موقعه الأصلي.",
      restore_error: "خطأ في الاستعادة:"
    },
    journal: {
      weather_not_found: "لم يتم العثور على الموقع المحدد: \"{{location}}\". يرجى التحقق من اسم المدينة.",
      weather_unauthorized: "مفتاح API للطقس غير صالح أو منتهي الصلاحية. يرجى تحديثه في الإعدادات.",
      weather_offline: "لا يوجد اتصال بالإنترنت أو لا يمكن الوصول إلى خدمة الطقس.",
      weather_api_error: "أرجعت خدمة الطقس خطأ."
    },
    materials: {
      upload_mobile_title: "رفع صورة من الجوال",
      upload_mobile_desc: "قم بتوصيل الجوال بـ **نفس شبكة WiFi** وامسح رمز QR:"
    }
  },
  de: {
    dashboard: {
      delete_worker_title: "Personal Löschen",
      delete_worker_msg: "Sind Sie sicher, dass Sie dieses Personal löschen möchten (in den Papierkorb verschieben)? Systemdaten werden nicht dauerhaft gelöscht, sondern aus den Listen entfernt."
    },
    common: { required_field: "Bitte füllen Sie dieses Feld aus." },
    recycle: {
      restore_confirm_title: "Wiederherstellung Bestätigen",
      restore_confirm_msg: "Sind Sie sicher, dass Sie diesen Datensatz wiederherstellen möchten? Er wird an seinen ursprünglichen Ort zurückverschoben.",
      restore_error: "Wiederherstellungsfehler:"
    },
    journal: {
      weather_not_found: "Angegebener Ort nicht gefunden: \"{{location}}\". Bitte überprüfen Sie den Namen der Stadt.",
      weather_unauthorized: "Wetter-API-Schlüssel ist ungültig oder abgelaufen. Bitte aktualisieren Sie ihn in den Einstellungen.",
      weather_offline: "Keine Internetverbindung oder Wetterdienst ist nicht erreichbar.",
      weather_api_error: "Der Wetterdienst hat einen Fehler zurückgegeben."
    },
    materials: {
      upload_mobile_title: "Foto vom Handy Hochladen",
      upload_mobile_desc: "Verbinden Sie das Handy mit dem **selben WLAN-Netzwerk** und scannen Sie den QR-Code:"
    }
  },
  fr: {
    dashboard: {
      delete_worker_title: "Supprimer le Personnel",
      delete_worker_msg: "Êtes-vous sûr de vouloir supprimer ce personnel (déplacer vers la corbeille) ? Les données du système ne seront pas supprimées définitivement, mais retirées des listes."
    },
    common: { required_field: "Veuillez remplir ce champ." },
    recycle: {
      restore_confirm_title: "Confirmation de Restauration",
      restore_confirm_msg: "Êtes-vous sûr de vouloir restaurer cet enregistrement ? Il sera replacé à son emplacement d'origine.",
      restore_error: "Erreur de restauration :"
    },
    journal: {
      weather_not_found: "Emplacement spécifié introuvable : \"{{location}}\". Veuillez vérifier le nom de la ville.",
      weather_unauthorized: "La clé API météo est invalide ou expirée. Veuillez la mettre à jour dans les paramètres.",
      weather_offline: "Pas de connexion Internet ou le service météo est inaccessible.",
      weather_api_error: "Le service météo a renvoyé une erreur."
    },
    materials: {
      upload_mobile_title: "Télécharger une Photo depuis un Mobile",
      upload_mobile_desc: "Connectez le mobile au **même réseau WiFi** et scannez le QR code :"
    }
  },
  ru: {
    dashboard: {
      delete_worker_title: "Удалить Персонал",
      delete_worker_msg: "Вы уверены, что хотите удалить этого сотрудника (переместить в корзину)? Системные данные не будут окончательно удалены, но будут скрыты из списков."
    },
    common: { required_field: "Пожалуйста, заполните это поле." },
    recycle: {
      restore_confirm_title: "Подтверждение Восстановления",
      restore_confirm_msg: "Вы уверены, что хотите восстановить эту запись? Она будет возвращена на свое исходное место.",
      restore_error: "Ошибка восстановления:"
    },
    journal: {
      weather_not_found: "Указанное место не найдено: \"{{location}}\". Пожалуйста, проверьте название города.",
      weather_unauthorized: "Ключ API погоды недействителен или истек. Пожалуйста, обновите его в настройках.",
      weather_offline: "Нет подключения к интернету или служба погоды недоступна.",
      weather_api_error: "Служба погоды вернула ошибку."
    },
    materials: {
      upload_mobile_title: "Загрузить Фото с Мобильного",
      upload_mobile_desc: "Подключите мобильный к **той же сети WiFi** и отсканируйте QR-код:"
    }
  },
  hi: {
    dashboard: {
      delete_worker_title: "कार्मिक हटाएं",
      delete_worker_msg: "क्या आप वाकई इस कार्मिक को हटाना (रीसायकल बिन में ले जाना) चाहते हैं? सिस्टम डेटा स्थायी रूप से नहीं हटाया जाएगा, लेकिन सूचियों से हटा दिया जाएगा।"
    },
    common: { required_field: "कृपया इस फ़ील्ड को भरें।" },
    recycle: {
      restore_confirm_title: "पुनर्स्थापना की पुष्टि",
      restore_confirm_msg: "क्या आप वाकई इस रिकॉर्ड को पुनर्स्थापित करना चाहते हैं? इसे इसके मूल स्थान पर वापस ले जाया जाएगा।",
      restore_error: "पुनर्स्थापना त्रुटि:"
    },
    journal: {
      weather_not_found: "निर्दिष्ट स्थान नहीं मिला: \"{{location}}\"। कृपया शहर का नाम जांचें।",
      weather_unauthorized: "मौसम API कुंजी अमान्य है या समाप्त हो गई है। कृपया इसे सेटिंग्स में अपडेट करें।",
      weather_offline: "कोई इंटरनेट कनेक्शन नहीं है या मौसम सेवा तक नहीं पहुंचा जा सकता है।",
      weather_api_error: "मौसम सेवा ने एक त्रुटि दी।"
    },
    materials: {
      upload_mobile_title: "मोबाइल से फोटो अपलोड करें",
      upload_mobile_desc: "मोबाइल को **समान वाईफाई नेटवर्क** से कनेक्ट करें और क्यूआर स्कैन करें:"
    }
  }
};

const files = fs.readdirSync(localesDir);
files.forEach(file => {
  if (file.endsWith('.json')) {
    const lang = file.replace('.json', '');
    const data = patchData[lang] || patchData.en; 
    
    const filePath = path.join(localesDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    try {
      const json = JSON.parse(content);
      
      if (!json.dashboard) json.dashboard = {};
      if (!json.common) json.common = {};
      if (!json.recycle) json.recycle = {};
      if (!json.journal) json.journal = {};
      if (!json.materials) json.materials = {};

      Object.assign(json.dashboard, { ...json.dashboard, ...data.dashboard });
      Object.assign(json.common, { ...json.common, ...data.common });
      Object.assign(json.recycle, { ...json.recycle, ...data.recycle });
      Object.assign(json.journal, { ...json.journal, ...data.journal });
      Object.assign(json.materials, { ...json.materials, ...data.materials });

      fs.writeFileSync(filePath, JSON.stringify(json, null, 2), 'utf8');
      console.log(`Patched language file: ${lang}.json`);
    } catch (err) {
      console.error(`Error processing ${lang}.json:`, err);
    }
  }
});
