const englishOpeners = [
  'Today you can trust your rhythm',
  'Your body deserves patience',
  'A softer pace can still move you forward',
  'Small care choices matter',
  'You are allowed to pause',
  'Your energy can rebuild quietly',
  'Gentleness is a real kind of strength',
  'Your needs are worth listening to',
  'A calm breath can reset the moment',
  'You can choose what supports you',
  'Your balance can return step by step',
  'Listening to your body is wisdom',
  'Rest can be part of progress',
  'Your inner steadiness is still here',
  'A kind start can change the day',
  'You can move at your own pace',
  'Your well-being is worth protecting',
  'One steady choice is enough for now',
  'You can meet today with softness',
  'Your body is working with you',
];

const englishClosers = [
  'and let the day unfold without pressure.',
  'while you give yourself the room you need.',
  'because progress does not have to be loud.',
  'and return to yourself with every breath.',
  'even if the next step is small.',
  'while your strength gathers in the background.',
  'and make space for what feels nourishing.',
  'without asking yourself to be perfect.',
  'as you notice what your body is saying.',
  'and remember that care is productive too.',
];

const makeEnglishAffirmations = () => {
  const affirmations = [];
  englishOpeners.forEach((opener) => {
    englishClosers.forEach((closer) => {
      affirmations.push(`${opener}, ${closer}`);
    });
  });
  return affirmations.slice(0, 200);
};

const tr = [
  'Bugün kendine iyi davranırsan gün de sana daha nazik davranır.',
  'Gücün geri geliyor; bunu adım adım hissedeceksin.',
  'Bugün küçük bir şey başarmak bile büyük bir ilerleme.',
  'Bedeninle aynı tarafta olduğunda her şey biraz daha kolaylaşır.',
  'Kendine ayırdığın her dakika enerjine geri döner.',
  'Bugün daha hafif hissetmen mümkün.',
  'Kendi ritmine güvendiğinde gün seninle uyumlanır.',
  'Bugün daha sakin, daha güçlü ve daha merkezdesin.',
  'Nazik başladığın her gün daha güzel bir yere varabilir.',
  'İyi hissetmek bazen sadece kendini dinlemekle başlar.',
  'Bugün bedenine güven, o sana yol gösterecek.',
  'Yavaş ilerlesen de doğru yönde gidiyorsun.',
  'Kendine verdiğin şefkat gerçek bir güçtür.',
  'Bugün biraz daha hafiflemen için yeni bir fırsat.',
  'Senin enerjin yeniden yükselmeyi biliyor.',
  'Bugün kendin için iyi olanı seçebilirsin.',
  'Bazen en doğru adım, kendine yüklenmemektir.',
  'İçindeki dayanıklılık sandığından daha güçlü.',
  'Bugün kendini korumak da güzel bir başarı.',
  'Ritmini tanıdıkça hayatın da daha anlaşılır olur.',
  'Bugün umut küçük bir ayrıntıda bile saklı olabilir.',
  'Senin iyi oluşun gerçekten önemli.',
  'Bir nefes, bir mola, bir yumuşak başlangıç yeter.',
  'Bugün kendi yanında durman her şeyi değiştirir.',
  'Kendine alan açtığında enerjin rahatça akmaya başlar.',
  'Bugün biraz daha güçlü hissedebilirsin.',
  'Bedeninle uyum yakaladığında zihnin de sakinleşir.',
  'Her döngü seni biraz daha iyi tanıtır.',
  'Bugün kendinle gurur duymak için güzel bir sebep bul.',
  'Küçük bir bakım bile gününün tonunu değiştirebilir.',
  'Sen dengeni yeniden kurabilecek güce sahipsin.',
  'Bugün kendini suçlamadan ilerle.',
  'Yumuşak olmak, zayıf olmak değildir.',
  'Bugün ihtiyacın olan şey biraz huzur ve biraz kendin.',
  'İçindeki güç sessiz olsa da çok gerçek.',
  'Bugün iyi hissetmeye bir adım daha yakınsın.',
  'Kendine gösterdiğin özen, hayatına yansır.',
  'Bugün kendi hızın tam da olması gereken hız.',
  'Bedeninin verdiği sinyaller sana destek olmak için var.',
  'Senin ritmin sana özel ve bu çok değerli.',
  'Bugün biraz daha parlamana hiçbir şey engel değil.',
  'Kendini seçmek, kendini büyütmektir.',
  'Bugün kalbini ve bedenini aynı anda dinle.',
  'İyi hissetmeye hakkın var.',
  'Bugün sakinliğini koruman bile büyük bir güç.',
  'Kendine nazik davrandığında hayat da yumuşar.',
  'Bugün bir şeyleri mükemmel yapmak zorunda değilsin.',
  'Olduğun halinle de çok kıymetlisin.',
  'Bugün kendi enerjini onarmak için doğru gün.',
  'Daha iyi hissetmek tek bir nazik kararla başlayabilir.',
];

const localizedAffirmations = {
  'tr-TR': tr,
  'en-US': makeEnglishAffirmations(),
  'en-GB': makeEnglishAffirmations(),
  'de-DE': [
    'Heute darfst du deinem Rhythmus vertrauen.',
    'Dein Koerper verdient Geduld und Freundlichkeit.',
    'Ein ruhiger Schritt ist immer noch Fortschritt.',
    'Kleine Fuersorge kann den Tag leichter machen.',
    'Du darfst langsamer werden und dich sammeln.',
    'Deine Kraft kommt Schritt fuer Schritt zurueck.',
    'Sanftheit ist eine echte Staerke.',
    'Deine Beduerfnisse sind wichtig.',
    'Ein Atemzug kann den Moment weicher machen.',
    'Du kannst heute waehlen, was dir gut tut.',
  ],
  'fr-FR': [
    'Aujourd hui, tu peux respecter ton rythme.',
    'Ton corps merite patience et douceur.',
    'Un petit pas reste un vrai progres.',
    'Un geste de soin peut alleger ta journee.',
    'Tu as le droit de ralentir.',
    'Ton energie peut revenir doucement.',
    'La douceur est une vraie force.',
    'Tes besoins meritent d etre ecoutes.',
    'Une respiration calme peut tout adoucir.',
    'Tu peux choisir ce qui te soutient.',
  ],
  'es-ES': [
    'Hoy puedes confiar en tu ritmo.',
    'Tu cuerpo merece paciencia y cuidado.',
    'Un paso pequeno tambien es avance.',
    'Un gesto amable puede cambiar tu dia.',
    'Puedes ir mas despacio sin culpa.',
    'Tu energia puede volver poco a poco.',
    'La suavidad tambien es fuerza.',
    'Tus necesidades merecen ser escuchadas.',
    'Una respiracion tranquila puede ayudarte.',
    'Hoy puedes elegir lo que te hace bien.',
  ],
  'es-419': [
    'Hoy puedes confiar en tu ritmo.',
    'Tu cuerpo merece paciencia y cuidado.',
    'Un paso pequeno tambien es avance.',
    'Un gesto amable puede cambiar tu dia.',
    'Puedes ir mas despacio sin culpa.',
    'Tu energia puede volver poco a poco.',
    'La suavidad tambien es fuerza.',
    'Tus necesidades merecen ser escuchadas.',
    'Una respiracion tranquila puede ayudarte.',
    'Hoy puedes elegir lo que te hace bien.',
  ],
  'pt-BR': [
    'Hoje voce pode confiar no seu ritmo.',
    'Seu corpo merece paciencia e cuidado.',
    'Um passo pequeno tambem e progresso.',
    'Um gesto de cuidado pode mudar o dia.',
    'Voce pode ir mais devagar sem culpa.',
    'Sua energia pode voltar aos poucos.',
    'Gentileza tambem e forca.',
    'Suas necessidades merecem ser ouvidas.',
    'Uma respiracao calma pode ajudar.',
    'Hoje voce pode escolher o que te faz bem.',
  ],
  'it-IT': [
    'Oggi puoi fidarti del tuo ritmo.',
    'Il tuo corpo merita pazienza e cura.',
    'Un piccolo passo e comunque progresso.',
    'Un gesto gentile puo alleggerire la giornata.',
    'Puoi rallentare senza sentirti in colpa.',
    'La tua energia puo tornare poco a poco.',
    'La dolcezza e una vera forza.',
    'I tuoi bisogni meritano ascolto.',
    'Un respiro calmo puo aiutarti.',
    'Oggi puoi scegliere cio che ti sostiene.',
  ],
  'ru-RU': [
    'Segodnya mozhno doveryat svoemu ritmu.',
    'Tvoe telo zasluzhivaet terpeniya i zaboty.',
    'Malenkiy shag tozhe dvizhenie vpered.',
    'Nezhnyy vybor mozhet oblegchit den.',
    'Mozhno zamedlitsya bez viny.',
    'Energiya mozhet vozvrashchatsya postepenno.',
    'Myagkost tozhe sila.',
    'Tvoi potrebnosti vazhny.',
    'Spokoynyy vdoh mozhet pomoch.',
    'Segodnya vyberi to, chto tebya podderzhivaet.',
  ],
  ar: [
    'Today you can move with your own rhythm.',
    'Your body deserves patience and care.',
    'A small step is still progress.',
    'A gentle choice can soften the day.',
    'You can slow down without guilt.',
    'Your energy can return little by little.',
    'Softness can be strength.',
    'Your needs deserve attention.',
    'A calm breath can help.',
    'Choose what supports you today.',
  ],
  'hi-IN': [
    'Aaj apne rhythm par bharosa kar sakti ho.',
    'Tumhara sharir dhairya aur care deserve karta hai.',
    'Chhota kadam bhi progress hai.',
    'Ek gentle choice din ko halka bana sakti hai.',
    'Tum bina guilt ke dheere chal sakti ho.',
    'Tumhari energy dheere dheere laut sakti hai.',
    'Softness bhi strength hai.',
    'Tumhari needs sunne layak hain.',
    'Ek shaant saans madad kar sakti hai.',
    'Aaj woh chuno jo tumhe support kare.',
  ],
};

const expandToFifty = (items) => {
  if (items.length >= 50) return items.slice(0, 50);
  const suffixes = [
    ' Keep it gentle.',
    ' Give yourself room.',
    ' One step is enough.',
    ' Your pace matters.',
    ' Let today be kind.',
  ];
  const expanded = [];
  items.forEach((item) => {
    suffixes.forEach((suffix) => expanded.push(`${item}${suffix}`));
  });
  return expanded.slice(0, 50);
};

export const getAffirmations = (language) => {
  const affirmations = localizedAffirmations[language] || localizedAffirmations['en-US'];
  if (language === 'en-US' || language === 'en-GB') return affirmations;
  return expandToFifty(affirmations);
};

export const AFFIRMATIONS = localizedAffirmations['tr-TR'];
