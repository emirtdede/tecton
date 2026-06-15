const fs = require('fs');
const path = require('path');

const localesDir = path.join('c:/Users/DEDE-/Desktop/Elektronik Yevmiye Defteri/src/renderer/src/locales');

const patchData = {
  tr: {
    dashboard: { delete_worker_title: "Personeli Sil", delete_worker_msg: "Bu personeli silmek (çöp kutusuna taşımak) istediğinize emin misiniz? Sistemdeki verileri kalıcı olarak silinmez, ancak listelerden kaldırılır." },
    common: { required_field: "Lütfen bu alanı doldurun." },
    recycle: { restore_confirm_title: "Geri Yükleme Onayı", restore_confirm_msg: "Bu kaydı geri yüklemek istediğinize emin misiniz? Kayıt, silinmeden önceki asıl yerine eklenecektir.", restore_error: "Geri yükleme hatası:" },
    journal: { weather_not_found: "Belirtilen konum bulunamadı: \"{{location}}\". Lütfen il/ilçe adını kontrol edin.", weather_unauthorized: "Hava durumu API anahtarı geçersiz veya süresi dolmuş. Lütfen Ayarlar sayfasından güncelleyin.", weather_offline: "İnternet bağlantısı yok veya hava durumu servisine ulaşılamıyor.", weather_api_error: "Hava durumu servisi hata döndürdü." },
    materials: { upload_mobile_title: "Mobil Fotoğraf Yükle", upload_mobile_desc: "Telefonunuzu ve bilgisayarınızı **aynı WiFi ağına** bağlayın, ardından QR kodu kameranızla taratın:", qr_link: "Bağlantı:" }
  },
  en: {
    dashboard: { delete_worker_title: "Delete Personnel", delete_worker_msg: "Are you sure you want to delete this personnel (move to recycle bin)? System data will not be permanently deleted, but removed from lists." },
    common: { required_field: "Please fill out this field." },
    recycle: { restore_confirm_title: "Restore Confirmation", restore_confirm_msg: "Are you sure you want to restore this record? It will be moved back to its original location.", restore_error: "Restore error:" },
    journal: { weather_not_found: "Specified location not found: \"{{location}}\". Please check the city/district name.", weather_unauthorized: "Weather API key is invalid or expired. Please update it in Settings.", weather_offline: "No internet connection or weather service is unreachable.", weather_api_error: "Weather service returned an error." },
    materials: { upload_mobile_title: "Upload Photo from Mobile", upload_mobile_desc: "Connect your mobile to the **same WiFi network** and scan the QR code:", qr_link: "Link:" }
  },
  es: {
    dashboard: { delete_worker_title: "Eliminar Personal", delete_worker_msg: "¿Estás seguro de que quieres eliminar este personal (mover a la papelera)? Los datos del sistema no se eliminarán permanentemente, pero se quitarán de las listas." },
    common: { required_field: "Por favor, complete este campo." },
    recycle: { restore_confirm_title: "Confirmación de Restauración", restore_confirm_msg: "¿Estás seguro de que deseas restaurar este registro? Se moverá de vuelta a su ubicación original.", restore_error: "Error de restauración:" },
    journal: { weather_not_found: "Ubicación especificada no encontrada: \"{{location}}\". Verifique el nombre de la ciudad.", weather_unauthorized: "La clave API del clima no es válida o ha caducado. Actualícela en Configuración.", weather_offline: "Sin conexión a internet o el servicio meteorológico no está disponible.", weather_api_error: "El servicio meteorológico devolvió un error." },
    materials: { upload_mobile_title: "Subir Foto desde Móvil", upload_mobile_desc: "Conecte el móvil a la **misma red WiFi** y escanee el QR:", qr_link: "Enlace:" }
  },
  ar: {
    dashboard: { delete_worker_title: "حذف الموظف", delete_worker_msg: "هل أنت متأكد أنك تريد حذف هذا الموظف (النقل إلى سلة المهملات)؟ لن يتم حذف بيانات النظام نهائيًا، بل ستتم إزالتها من القوائم فقط." },
    common: { required_field: "يرجى ملء هذا الحقل." },
    recycle: { restore_confirm_title: "تأكيد الاستعادة", restore_confirm_msg: "هل أنت متأكد أنك تريد استعادة هذا السجل؟ سيتم إرجاعه إلى موقعه الأصلي.", restore_error: "خطأ في الاستعادة:" },
    journal: { weather_not_found: "لم يتم العثور على الموقع المحدد: \"{{location}}\". يرجى التحقق من اسم المدينة.", weather_unauthorized: "مفتاح API للطقس غير صالح أو منتهي الصلاحية. يرجى تحديثه في الإعدادات.", weather_offline: "لا يوجد اتصال بالإنترنت أو لا يمكن الوصول إلى خدمة الطقس.", weather_api_error: "أرجعت خدمة الطقس خطأ." },
    materials: { upload_mobile_title: "رفع صورة من الجوال", upload_mobile_desc: "قم بتوصيل الجوال بـ **نفس شبكة WiFi** وامسح رمز QR:", qr_link: "الرابط:" }
  },
  de: {
    dashboard: { delete_worker_title: "Personal Löschen", delete_worker_msg: "Sind Sie sicher, dass Sie dieses Personal löschen möchten (in den Papierkorb verschieben)? Systemdaten werden nicht dauerhaft gelöscht, sondern aus den Listen entfernt." },
    common: { required_field: "Bitte füllen Sie dieses Feld aus." },
    recycle: { restore_confirm_title: "Wiederherstellung Bestätigen", restore_confirm_msg: "Sind Sie sicher, dass Sie diesen Datensatz wiederherstellen möchten? Er wird an seinen ursprünglichen Ort zurückverschoben.", restore_error: "Wiederherstellungsfehler:" },
    journal: { weather_not_found: "Angegebener Ort nicht gefunden: \"{{location}}\". Bitte überprüfen Sie den Namen der Stadt.", weather_unauthorized: "Wetter-API-Schlüssel ist ungültig oder abgelaufen. Bitte aktualisieren Sie ihn in den Einstellungen.", weather_offline: "Keine Internetverbindung oder Wetterdienst ist nicht erreichbar.", weather_api_error: "Der Wetterdienst hat einen Fehler zurückgegeben." },
    materials: { upload_mobile_title: "Foto vom Handy Hochladen", upload_mobile_desc: "Verbinden Sie das Handy mit dem **selben WLAN-Netzwerk** und scannen Sie den QR-Code:", qr_link: "Link:" }
  },
  fr: {
    dashboard: { delete_worker_title: "Supprimer le Personnel", delete_worker_msg: "Êtes-vous sûr de vouloir supprimer ce personnel (déplacer vers la corbeille) ? Les données du système ne seront pas supprimées définitivement, mais retirées des listes." },
    common: { required_field: "Veuillez remplir ce champ." },
    recycle: { restore_confirm_title: "Confirmation de Restauration", restore_confirm_msg: "Êtes-vous sûr de vouloir restaurer cet enregistrement ? Il sera replacé à son emplacement d'origine.", restore_error: "Erreur de restauration :" },
    journal: { weather_not_found: "Emplacement spécifié introuvable : \"{{location}}\". Veuillez vérifier le nom de la ville.", weather_unauthorized: "La clé API météo est invalide ou expirée. Veuillez la mettre à jour dans les paramètres.", weather_offline: "Pas de connexion Internet ou le service météo est inaccessible.", weather_api_error: "Le service météo a renvoyé une erreur." },
    materials: { upload_mobile_title: "Télécharger une Photo depuis un Mobile", upload_mobile_desc: "Connectez le mobile au **même réseau WiFi** et scannez le QR code :", qr_link: "Lien :" }
  },
  ru: {
    dashboard: { delete_worker_title: "Удалить Персонал", delete_worker_msg: "Вы уверены, что хотите удалить этого сотрудника (переместить в корзину)? Системные данные не будут окончательно удалены, но будут скрыты из списков." },
    common: { required_field: "Пожалуйста, заполните это поле." },
    recycle: { restore_confirm_title: "Подтверждение Восстановления", restore_confirm_msg: "Вы уверены, что хотите восстановить эту запись? Она будет возвращена на свое исходное место.", restore_error: "Ошибка восстановления:" },
    journal: { weather_not_found: "Указанное место не найдено: \"{{location}}\". Пожалуйста, проверьте название города.", weather_unauthorized: "Ключ API погоды недействителен или истек. Пожалуйста, обновите его в настройках.", weather_offline: "Нет подключения к интернету или служба погоды недоступна.", weather_api_error: "Служба погоды вернула ошибку." },
    materials: { upload_mobile_title: "Загрузить Фото с Мобильного", upload_mobile_desc: "Подключите мобильный к **той же сети WiFi** и отсканируйте QR-код:", qr_link: "Ссылка:" }
  },
  hi: {
    dashboard: { delete_worker_title: "कार्मिक हटाएं", delete_worker_msg: "क्या आप वाकई इस कार्मिक को हटाना (रीसायकल बिन में ले जाना) चाहते हैं? सिस्टम डेटा स्थायी रूप से नहीं हटाया जाएगा, लेकिन सूचियों से हटा दिया जाएगा।" },
    common: { required_field: "कृपया इस फ़ील्ड को भरें।" },
    recycle: { restore_confirm_title: "पुनर्स्थापना की पुष्टि", restore_confirm_msg: "क्या आप वाकई इस रिकॉर्ड को पुनर्स्थापित करना चाहते हैं? इसे इसके मूल स्थान पर वापस ले जाया जाएगा।", restore_error: "पुनर्स्थापना त्रुटि:" },
    journal: { weather_not_found: "निर्दिष्ट स्थान नहीं मिला: \"{{location}}\"। कृपया शहर का नाम जांचें।", weather_unauthorized: "मौसम API कुंजी अमान्य है या समाप्त हो गई है। कृपया इसे सेटिंग्स में अपडेट करें।", weather_offline: "कोई इंटरनेट कनेक्शन नहीं है या मौसम सेवा तक नहीं पहुंचा जा सकता है।", weather_api_error: "मौसम सेवा ने एक त्रुटि दी।" },
    materials: { upload_mobile_title: "मोबाइल से फोटो अपलोड करें", upload_mobile_desc: "मोबाइल को **समान वाईफाई नेटवर्क** से कनेक्ट करें और क्यूआर स्कैन करें:", qr_link: "लिंक:" }
  },
  zh: {
    dashboard: { delete_worker_title: "删除人员", delete_worker_msg: "您确定要删除此人员（移至回收站）吗？系统数据不会被永久删除，但会从列表中移除。" },
    common: { required_field: "请填写此字段。" },
    recycle: { restore_confirm_title: "恢复确认", restore_confirm_msg: "您确定要恢复此记录吗？它将被移回其原始位置。", restore_error: "恢复错误：" },
    journal: { weather_not_found: "找不到指定位置：\"{{location}}\"。请检查城市/区域名称。", weather_unauthorized: "天气 API 密钥无效或已过期。请在设置中更新它。", weather_offline: "无网络连接或无法访问天气服务。", weather_api_error: "天气服务返回错误。" },
    materials: { upload_mobile_title: "从手机上传照片", upload_mobile_desc: "将您的手机连接到**同一 WiFi 网络**并扫描二维码：", qr_link: "链接：" }
  },
  ja: {
    dashboard: { delete_worker_title: "人員の削除", delete_worker_msg: "この人員を削除して（ごみ箱に移動）もよろしいですか？システムデータは完全に削除されませんが、リストから削除されます。" },
    common: { required_field: "このフィールドに入力してください。" },
    recycle: { restore_confirm_title: "復元の確認", restore_confirm_msg: "このレコードを復元してもよろしいですか？元の場所に戻されます。", restore_error: "復元エラー：" },
    journal: { weather_not_found: "指定された場所が見つかりません: \"{{location}}\"。市区町村名を確認してください。", weather_unauthorized: "天気 API キーが無効または期限切れです。設定で更新してください。", weather_offline: "インターネット接続がないか、天気サービスにアクセスできません。", weather_api_error: "天気サービスがエラーを返しました。" },
    materials: { upload_mobile_title: "モバイルから写真をアップロード", upload_mobile_desc: "モバイルを**同じWiFiネットワーク**に接続し、QRコードをスキャンします:", qr_link: "リンク:" }
  },
  ko: {
    dashboard: { delete_worker_title: "인원 삭제", delete_worker_msg: "이 인원을 삭제(휴지통으로 이동)하시겠습니까? 시스템 데이터는 영구적으로 삭제되지 않지만 목록에서 제거됩니다." },
    common: { required_field: "이 필드를 작성해 주세요." },
    recycle: { restore_confirm_title: "복원 확인", restore_confirm_msg: "이 기록을 복원하시겠습니까? 원래 위치로 되돌아갑니다.", restore_error: "복원 오류:" },
    journal: { weather_not_found: "지정된 위치를 찾을 수 없습니다: \"{{location}}\". 시/구 이름을 확인하세요.", weather_unauthorized: "날씨 API 키가 유효하지 않거나 만료되었습니다. 설정에서 업데이트하세요.", weather_offline: "인터넷 연결이 없거나 날씨 서비스에 연결할 수 없습니다.", weather_api_error: "날씨 서비스에서 오류를 반환했습니다." },
    materials: { upload_mobile_title: "모바일에서 사진 업로드", upload_mobile_desc: "모바일을 **동일한 WiFi 네트워크**에 연결하고 QR 코드를 스캔하세요:", qr_link: "링크:" }
  },
  cs: {
    dashboard: { delete_worker_title: "Odstranit personál", delete_worker_msg: "Opravdu chcete tento personál odstranit (přesunout do koše)? Systémová data nebudou trvale smazána, ale budou odstraněna ze seznamů." },
    common: { required_field: "Vyplňte prosím toto pole." },
    recycle: { restore_confirm_title: "Potvrzení obnovy", restore_confirm_msg: "Opravdu chcete tento záznam obnovit? Bude přesunut zpět na původní místo.", restore_error: "Chyba obnovy:" },
    journal: { weather_not_found: "Zadaná poloha nenalezena: \"{{location}}\". Zkontrolujte prosím název města/okresu.", weather_unauthorized: "Klíč API pro počasí je neplatný nebo vypršel. Aktualizujte jej prosím v Nastavení.", weather_offline: "Žádné připojení k internetu nebo služba počasí je nedostupná.", weather_api_error: "Služba počasí vrátila chybu." },
    materials: { upload_mobile_title: "Nahrát fotku z mobilu", upload_mobile_desc: "Připojte mobil ke **stejné síti WiFi** a naskenujte QR kód:", qr_link: "Odkaz:" }
  },
  da: {
    dashboard: { delete_worker_title: "Slet Personale", delete_worker_msg: "Er du sikker på, at du vil slette dette personale (flytte til papirkurven)? Systemdata vil ikke blive permanent slettet, men fjernet fra lister." },
    common: { required_field: "Udfyld venligigst dette felt." },
    recycle: { restore_confirm_title: "Bekræft Gendannelse", restore_confirm_msg: "Er du sikker på, at du vil gendanne denne post? Den vil blive flyttet tilbage til sin oprindelige placering.", restore_error: "Gendannelsesfejl:" },
    journal: { weather_not_found: "Angivet placering ikke fundet: \"{{location}}\". Tjek venligst by/områdenavnet.", weather_unauthorized: "Vejr API-nøglen er ugyldig eller udløbet. Opdater den venligst i Indstillinger.", weather_offline: "Ingen internetforbindelse, eller vejrtjenesten er utilgængelig.", weather_api_error: "Vejrtjenesten returnerede en fejl." },
    materials: { upload_mobile_title: "Upload Foto fra Mobil", upload_mobile_desc: "Tilslut din mobil til **samme WiFi-netværk** og scan QR-koden:", qr_link: "Link:" }
  },
  it: {
    dashboard: { delete_worker_title: "Elimina Personale", delete_worker_msg: "Sei sicuro di voler eliminare questo personale (spostarlo nel cestino)? I dati di sistema non verranno eliminati in modo permanente, ma rimossi dagli elenchi." },
    common: { required_field: "Si prega di compilare questo campo." },
    recycle: { restore_confirm_title: "Conferma Ripristino", restore_confirm_msg: "Sei sicuro di voler ripristinare questo record? Verrà riportato nella sua posizione originale.", restore_error: "Errore di ripristino:" },
    journal: { weather_not_found: "Posizione specificata non trovata: \"{{location}}\". Controlla il nome della città/distretto.", weather_unauthorized: "La chiave API del meteo non è valida o è scaduta. Aggiornala in Impostazioni.", weather_offline: "Nessuna connessione Internet o il servizio meteo non è raggiungibile.", weather_api_error: "Il servizio meteo ha restituito un errore." },
    materials: { upload_mobile_title: "Carica Foto da Cellulare", upload_mobile_desc: "Collega il cellulare alla **stessa rete WiFi** e scansiona il codice QR:", qr_link: "Link:" }
  },
  nl: {
    dashboard: { delete_worker_title: "Personeel Verwijderen", delete_worker_msg: "Weet u zeker dat u dit personeel wilt verwijderen (naar de prullenbak verplaatsen)? Systeemgegevens worden niet permanent verwijderd, maar uit lijsten verwijderd." },
    common: { required_field: "Vul dit veld in." },
    recycle: { restore_confirm_title: "Herstel Bevestiging", restore_confirm_msg: "Weet u zeker dat u dit record wilt herstellen? Het wordt teruggeplaatst naar de oorspronkelijke locatie.", restore_error: "Herstelfout:" },
    journal: { weather_not_found: "Opgegeven locatie niet gevonden: \"{{location}}\". Controleer de naam van de stad/het district.", weather_unauthorized: "Weer-API-sleutel is ongeldig of verlopen. Werk deze bij in Instellingen.", weather_offline: "Geen internetverbinding of weerdienst is onbereikbaar.", weather_api_error: "Weerdienst heeft een fout geretourneerd." },
    materials: { upload_mobile_title: "Foto Uploaden vanaf Mobiel", upload_mobile_desc: "Verbind uw mobiel met **hetzelfde WiFi-netwerk** en scan de QR-code:", qr_link: "Link:" }
  },
  no: {
    dashboard: { delete_worker_title: "Slett Personell", delete_worker_msg: "Er du sikker på at du vil slette dette personellet (flytte til papirkurven)? Systemdata vil ikke bli permanent slettet, men fjernet fra lister." },
    common: { required_field: "Vennligst fyll ut dette feltet." },
    recycle: { restore_confirm_title: "Bekreft Gjenoppretting", restore_confirm_msg: "Er du sikker på at du vil gjenopprette denne posten? Den vil bli flyttet tilbake til sin opprinnelige plassering.", restore_error: "Gjenopprettingsfeil:" },
    journal: { weather_not_found: "Spesifisert plassering ikke funnet: \"{{location}}\". Vennligst sjekk by/distriktsnavnet.", weather_unauthorized: "Vær-API-nøkkelen er ugyldig eller utløpt. Vennligst oppdater den i Innstillinger.", weather_offline: "Ingen internettilkobling eller værtjenesten er utilgjengelig.", weather_api_error: "Værtjenesten returnerte en feil." },
    materials: { upload_mobile_title: "Last Opp Bilde fra Mobil", upload_mobile_desc: "Koble mobilen til **samme WiFi-nettverk** og skann QR-koden:", qr_link: "Lenke:" }
  },
  pl: {
    dashboard: { delete_worker_title: "Usuń Personel", delete_worker_msg: "Czy na pewno chcesz usunąć ten personel (przenieść do kosza)? Dane systemowe nie zostaną trwale usunięte, ale usunięte z list." },
    common: { required_field: "Proszę wypełnić to pole." },
    recycle: { restore_confirm_title: "Potwierdzenie Przywrócenia", restore_confirm_msg: "Czy na pewno chcesz przywrócić ten rekord? Zostanie on przeniesiony z powrotem na swoje pierwotne miejsce.", restore_error: "Błąd przywracania:" },
    journal: { weather_not_found: "Nie znaleziono określonej lokalizacji: \"{{location}}\". Proszę sprawdzić nazwę miasta/dzielnicy.", weather_unauthorized: "Klucz API pogody jest nieprawidłowy lub wygasł. Zaktualizuj go w Ustawieniach.", weather_offline: "Brak połączenia z Internetem lub usługa pogodowa jest niedostępna.", weather_api_error: "Usługa pogodowa zwróciła błąd." },
    materials: { upload_mobile_title: "Prześlij Zdjęcie z Telefonu", upload_mobile_desc: "Podłącz telefon do **tej samej sieci WiFi** i zeskanuj kod QR:", qr_link: "Link:" }
  },
  pt: {
    dashboard: { delete_worker_title: "Excluir Pessoal", delete_worker_msg: "Tem certeza de que deseja excluir este pessoal (mover para a lixeira)? Os dados do sistema não serão excluídos permanentemente, mas removidos das listas." },
    common: { required_field: "Por favor, preencha este campo." },
    recycle: { restore_confirm_title: "Confirmação de Restauração", restore_confirm_msg: "Tem certeza de que deseja restaurar este registro? Ele será movido de volta ao seu local original.", restore_error: "Erro de restauração:" },
    journal: { weather_not_found: "Localização especificada não encontrada: \"{{location}}\". Verifique o nome da cidade/distrito.", weather_unauthorized: "A chave da API de clima é inválida ou expirou. Atualize-a nas Configurações.", weather_offline: "Sem conexão com a internet ou serviço de clima inacessível.", weather_api_error: "O serviço de clima retornou um erro." },
    materials: { upload_mobile_title: "Enviar Foto do Celular", upload_mobile_desc: "Conecte seu celular à **mesma rede WiFi** e escaneie o código QR:", qr_link: "Link:" }
  },
  sv: {
    dashboard: { delete_worker_title: "Ta Bort Personal", delete_worker_msg: "Är du säker på att du vill ta bort denna personal (flytta till papperskorgen)? Systemdata kommer inte att raderas permanent, men tas bort från listor." },
    common: { required_field: "Vänligen fyll i detta fält." },
    recycle: { restore_confirm_title: "Bekräfta Återställning", restore_confirm_msg: "Är du säker på att du vill återställa denna post? Den kommer att flyttas tillbaka till sin ursprungliga plats.", restore_error: "Återställningsfel:" },
    journal: { weather_not_found: "Angiven plats hittades inte: \"{{location}}\". Vänligen kontrollera stadens/områdets namn.", weather_unauthorized: "Väder-API-nyckeln är ogiltig eller har gått ut. Uppdatera den i Inställningar.", weather_offline: "Ingen internetanslutning eller vädertjänsten kan inte nås.", weather_api_error: "Vädertjänsten returnerade ett fel." },
    materials: { upload_mobile_title: "Ladda Upp Foto från Mobil", upload_mobile_desc: "Anslut din mobil till **samma WiFi-nätverk** och skanna QR-koden:", qr_link: "Länk:" }
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
      console.log(`Successfully patched: ${lang}.json`);
    } catch (err) {
      console.error(`Error processing ${lang}.json:`, err);
    }
  }
});
