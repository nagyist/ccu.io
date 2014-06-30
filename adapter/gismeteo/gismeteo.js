﻿//    Gismeteo Driver for CCU.IO
//    2014 copyright Bluefox
//
// Это демо драйвер, созданный для того, что бы объяснить, как писать собственный драйвер
// Рассмотрим web сервис gismeteo.ru. Он возвращает в XML прогноз погоды и актуальные значения для погоды в конкретном городе.
// Вы можете выбрать ID города на странице http://informer.gismeteo.com/getcode/xml.php
// ID города можно считать немного ниже в виде http://informer.gismeteo.com/xml/29865_1.xml, где 29865 ID города.
// Вызвав ссылку с xml можно посмотреть на формат данных. Они приведены ниже в коде.
// Читайте коментарии на русском и, надеюсь, кое сто будет понятно.

// Es sit ein Demo-Adapter. Der wurde dafür geschrieben um zu erklären, wie man einen Adapter kreirt.
// Nehmen wir einen Web-Service gismeteo.ru. Service gibt zurück die Vorhersage für Morgan und aktuelle Daten für jetzt in einer bestiemten Stadt.
// Leider unterstützt der Service keine nicht russische Städte, aber es ist doch nur einen Beispiel.
// Man kann auf der Seite http://informer.gismeteo.com/getcode/xml.php eine ID für die Stadt finden.
// Z.B. http://informer.gismeteo.com/xml/27612_1.xml ist für Moskau, wo 27612 ist ID für Moskau.
// Wenn man das Link aufruft, kann man die Struktur von XML Antwort sehen. Einen Beispiel kann man unten im Kode sehen.
// Lesen sie die Kommentare auf Deutsch und, hoffentlich, wird einiges klare.

// This is a demo adapter. This adapter was written as instruction for own adapter creation.
// Let's take the web service gismeteo.ru. The service returns the weather forecast for tomorrow and actual weather data for todey in some specific city.
// Unfortunately, the servvice does not support non-russian cities, but this adapter is only an example.
// On the web page http://informer.gismeteo.com/getcode/xml.php the ID of the specific city can be found.
// For example http://informer.gismeteo.com/xml/27612_1.xml is link for xml data for Moscow, where 27612 is the ID for Moscow.
// If you call the given link, you can see the sturcture of the XML response. One answer can be found bellow in code.
// Read the comments and, hopefully, it will be something clearer.



// Считать файл с настройками
// Lese die Datei mit Adapter-Einstellungen
// Read the file with adapter settings
var settings = require(__dirname + '/../../settings.js');

// Если настройки для драйвера не существуют или драйвер деактивирован
// Falls keine Einstellungen oder Adapter ist deaktiviert
// If no settings for adapter or adapter is deactivated
if (!settings.adapters.gismeteo || !settings.adapters.gismeteo.enabled) {
    // Завершаем процесс и не тратим память впустую
    // Beenden wir den Prozess und verschenden die Ressourcen nicht.
    // Stop the process and save the memory and CPU time.
    process.exit();
}

// Подключаем модули для протоколирования и коммуникации с CCU.IO
// Die Module für Logging und Socket-Kommunikation laden
// Load the modules for logging and socket communication
var logger =    require(__dirname + '/../../logger.js'),// Own ccu.io module
    io =        require('socket.io-client'),            // node.js module

    // Загрузим еще и модуль для выполнения GET/POST запросов по http
    // Der Modul für GET/POST anfragen laden, weil wir nehmen die Antworte mit HTTP GET
    // Load the HTTP GET/POST module to request the XML file per HTTP GET
    http =        require('http'),

    // А также модуль парсинга XML, т.к. ГисМетео отдает результаты в XML
    // Und noch einen Module für XML-Parsing.
    // And another module for xml parsing
    parseString =  require('xml2js').parseString;


// Надо продумать структуру данных. Данные в CCU.IO устроены по следующему принципу.
// Устройство1 => Канал1 => Данные1
//                Канал2 => Данные2
//                       => Данные3
// Устройство2 => Канал3 => Данные4
//                Канал4 => Данные5
// То есть в корне располагается устройство, у которого есть список каналов. Каждый канал должен иметь в списке детей хотя бы одну переменную (datapoint).

// Man muss über die Datenstruktur nachdenken. Die Daten in CCU.IO sind wie folgt aufgebaut:
// Gerät1 => Kanal1 => Datenpunkt1
//           Kanal2 => Datenpunkt2
//                  => Datenpunkt3
// Gerät2 => Kanal3 => Datenpunkt4
//           Kanal4 => Datenpunkt5
// Das heißt im Root sind die Geäte die eine Liste von Kanälen haben. Jeder Kanal soll die Liste mit mindestens einem Kind haben.

// You should think about the data structure of the channel. The data in CCU.IO looks like:
// Device1 => Channel1 => Data point1
//            Channel2 => Data point2
//                     => Data point3
// Device1 => Channel3 => Data point4
//            Channel4 => Data point5
// The devcices in root have the list of child channels. Every channel must have the list with at least one data point.

// Если посмотреть на возвращаемый формат XML файла:
// Hier ist ungefähr das, was als XML - Antwort kommt:
// Here is an example of one XML response of the service:
//<MMWEATHER>
//	<REPORT type="frc3">
//		<TOWN index="28722" sname="%D3%F4%E0" latitude="54" longitude="55">
//			<FORECAST day="16" month="06" year="2014" hour="21" tod="3" predict="0" weekday="2">
//				<PHENOMENA cloudiness="0" precipitation="10" rpower="0" spower="0"/>
//				<PRESSURE max="745" min="743"/>
//				<TEMPERATURE max="15" min="13"/>
//				<WIND min="1" max="3" direction="5"/>
//				<RELWET max="77" min="75"/>
//				<HEAT min="13" max="15"/>
//			</FORECAST>
//			<FORECAST day="17" month="06" year="2014" hour="03" tod="0" predict="0" weekday="3">
//				<PHENOMENA cloudiness="1" precipitation="10" rpower="0" spower="0"/>
//				<PRESSURE max="746" min="744"/>
//				<TEMPERATURE max="11" min="9"/>
//				<WIND min="-1" max="1" direction="1"/>
//				<RELWET max="93" min="91"/>
//				<HEAT min="9" max="11"/>
//			</FORECAST>
//			<FORECAST day="17" month="06" year="2014" hour="09" tod="1" predict="0" weekday="3">
//				<PHENOMENA cloudiness="0" precipitation="10" rpower="0" spower="0"/>
//				<PRESSURE max="747" min="745"/>
//				<TEMPERATURE max="15" min="13"/>
//				<WIND min="0" max="2" direction="5"/>
//				<RELWET max="85" min="83"/>
//				<HEAT min="13" max="15"/>
//			</FORECAST>
//			<FORECAST day="17" month="06" year="2014" hour="15" tod="2" predict="0" weekday="3">
//				<PHENOMENA cloudiness="2" precipitation="10" rpower="0" spower="0"/>
//				<PRESSURE max="748" min="746"/>
//				<TEMPERATURE max="20" min="18"/>
//				<WIND min="3" max="5" direction="5"/>
//				<RELWET max="54" min="52"/>
//				<HEAT min="18" max="20"/>
//			</FORECAST>
//		</TOWN>
//	</REPORT>
//</MMWEATHER>
 
// То можно видеть, что ответ содержит данные для сегодня и три значения на завтра.
// Я буду использовать вот такую структуру данных.

// Man kann sehen, dass der Antwort hat die Daten für jetzt und 3 Werte für Morgen.
// Ich werde folgende Datenstruktur benutzen:

// You can see, that the answer has one value for today/now and 3 following values for future.
// I will use following data structure:

// gismeteo(Device) => now (channel)   => DATE         (datapoint)
//                                     => PRESSURE_MIN (datapoint)
//                                     => PRESSURE_MAX (datapoint)
//                                     => TEMPERATURE  (datapoint)
//                                     => HUMIDITY     (datapoint. Может, конечно, RELWET означает вероятность дождя, но для данного примера это не так важно
//                                                                 Vielleicht RELWET ist Regenwahrscheinlichkeit, aber für diesen Beispiel ist es nicht wichtig
//                                                                 May be RELWET is rain probability, but for this example it is not important.
// 
//                     next (channel)  => DATE         (datapoint)
//                                     => PRESSURE_MIN (datapoint)
//                                     => PRESSURE_MAX (datapoint)
//                                     => TEMPERATURE  (datapoint)
//                                     => HUMIDITY     (datapoint.
//


// Создадим внутренние переменные:
// Interne Variable definieren:
// Let's define internal variables:
var pollTimer        = null, // Таймер для опроса gismeteo
                             // Timer für die Anfragen
                             // Timer for polling

    socket           = null, // Сокет для коммуникации с CCU.IO
                             // Socket für die Kommunikation mit CCU IO
                             // Socket for communication with CCU IO

    gismeteoSettings = settings.adapters.gismeteo.settings; // Переменная с настройками драйвера (вернемся к настройкам позже)
                                                            // Die Variable mit der Adapter-Einstellungen (wir reden darüber speter)
                                                            // The variable with adapter settings (we will talk about it later)
   
// Соединяемся с CCU.IO
// Verbinden mi CCU.IO
// Connect with CCU.IO
if (settings.ioListenPort) {
    socket = io.connect("127.0.0.1", {
        port: settings.ioListenPort
    });
} else if (settings.ioListenPortSsl) {
    socket = io.connect("127.0.0.1", {
        port: settings.ioListenPortSsl,
        secure: true
    });
} else {
    // no port defined => exit
    process.exit();
}

// Реакция на события из сокета
// Reaktion auf die Ereignise von CCU.IO
// Handlers for events from CCU.IO

// При соединении
// Wenn Verbindung aufgebaut ist
// If connection established
socket.on('connect', function () {
    // драйвер соединился с ccu.io
    // Adapter ist mit CCU.IO Verbunden
    // Adapter is connected with CCU.IO
    logger.info("adapter gismeteo connected to ccu.io");
});

socket.on('disconnect', function () {
    // драйвер потерял соединение с ccu.io. Ничего делать не надо. Он сам снова соединится.
    // Adapter hat die Verbindung mit CCU.IO verlohren. Man muss nichts machen. Die Verbindung wird wieder von selbst aufgebaut.
    // Adapter has lost the connection with CCU.IO. The connection will be reestablished automatically.
    logger.info("adapter gismeteo disconnected from ccu.io");
});

// Событие от CCU.IO. Драйвер получает сообщения обо всех изменениях, а не только своих.
// Ein Ereignis von CCU.IO. Adapter bekommt die Nachrichten über alle Änderungen und nicht nur eigenen.
// Handler for event from CCU.IO. The adapter gets the events about all datapoints and not only owns.
socket.on('event', function (obj) {
    if (!obj || !obj[0]) {
        return;
    }
	
	// CCU.IO шлёт массив из 4х переменных [ID, value, direction, timestamp]
    // CCU.IO sendet ein Array mit 4 Variablen [ID, Wert, Richtung, Zeitstempel]
    // CCU.IO sends the array with 4 variables [ID, Value, Direction, Time stamp]
	var ID  = obj[0];
	var val = obj[1];
	var dir = obj[2]; // direction true означает, что данные пришли от драйвера, false - данные пришли от GUI, ScriptEngine, или другого адаптера
	                  // Falls die Richtung ist "true", das heißt die Daten sind von internen Adapter oder von uns selbst gekommen. "false" bedeutet, dass die Daten sind von GUI/DashUI oder ScriptEngine.
                      // If the direction is "true" that means the data is from other internal adapter or from ourself. "false" means the data is from GUI/DashUI or from script engine.
    var ts  = obj[3];

    // We don' want to process our own changes.
	if (dir) {
		return;
	}

    // If date has value true => reload the data immediately
	if ((ID == nowChannel_DPs.DATE || ID == nextChannel_DPs.DATE) && val == true) {
		pollGismeteo();
	}	
});

// Функция завершения драйвера. Очень важно, иначе драйвер при перезапуске CCU.IO останется висеть в памяти и будет дальше пытаться соединится
// Die Funktion um Adapter runterzufahren. Es ist sehr wichtig. Sonst es kann sein, dass zwei instanzen von Adapter laufen werden.
// Driver termination function. It is very important, elsewise it can be possible, that two instances of the driver run simultaneously.
function stop() {
    logger.info("adapter gismeteo terminating");

	// Останавливаем таймер
    // Anhalten der Poll-Timer
    // Stop the poll timer
	if (pollTimer) {
		clearInterval(pollTimer);
		pollTimer = null; // форсируем запуск сборщика мусора
                          // Sage zu Garbage Collector, dass Objekt nicht mehr benutzt wird
                          // Say to garbage collector, that object is free now
	}
	
	// и через 250 мсекунд завершаем процесс
    // und nach 250 msek halten wir den Prozess an
    // and after 250 ms stop the process
    setTimeout(function () {
        process.exit();
    }, 250);
}

// Signals under linux
process.on('SIGINT', function () {
    stop();
});
process.on('SIGTERM', function () {
    stop();
});

// Упростим вызов создания объекта: создать объект и задать значение для объекта
// Die Hüllen für die Basis-Funktionen: kreiere Objekt und setze Zustand von einem Objekt
// The wrapper for the basic functions: create object and set value of the object
function setObject (id, obj) {
	socket.emit("setObject", id, obj);
}
function setState(id, val) {
	socket.emit("setState", [id, val, null, true]);
}

// Теперь создаем объекты. Здесь важно использовать настройки для драйвера, которая определяет адресное пространство драйвера firstId
// Jetzt kreiren wir die Datenobjekte in CCU.IO. Es ist wichtig die Einstellungen für Adapter zu nutzen. firstId beschriebt die erste ID für diesen Adapter.
// Now create the data objects in CCU.IO for adapter. It is important to use firtsId variable in adpater settings to start the object IDs of adapter from it.
var rootDevice = gismeteoSettings.firstId;
var nowChannel = rootDevice + 1;
var nowChannel_DPs = {
		DATE:         nowChannel + 1, 
		PRESSURE_MIN: nowChannel + 2, 
		PRESSURE_MAX: nowChannel + 3,
		TEMPERATURE:  nowChannel + 4,
		HUMIDITY:     nowChannel + 5
	};

var nextChannel = nowChannel + 6;
var nextChannel_DPs = {
		DATE:         nextChannel + 1, 
		PRESSURE_MIN: nextChannel + 2, 
		PRESSURE_MAX: nextChannel + 3,
		TEMPERATURE:  nextChannel + 4,
		HUMIDITY:     nextChannel + 5
	};

// Создаем объекты в CCU.IO при старте
// Objekten beim Adapterstart erzeugen
// Create data objects by adapter start
function initGismeteo () {
	// Сначала переменные для канала сегодня
    // Erst die Objekte für jetzt
	setObject(nowChannel_DPs.DATE, {
		Name:     "gismeteo.now.DATE",
		TypeName: "HSSDP", // HSSDP говорит CCU.IO, что это переменная содержит реальные значения а не просто структурный элемент, т.е. это datapoint
                           // HSSDP sagt in CCU.IO, dass es ein Datenpunkt ist und das Objekt die konkrete Daten hat.
                           // HSSDP says in CCU.IO, that this is a datapoint and not just a structure element.
		Parent:   nowChannel 
	});
	setObject(nowChannel_DPs.PRESSURE_MIN, {
		Name:     "gismeteo.now.PRESSURE_MIN",
		TypeName: "HSSDP",
		Parent:   nowChannel 
	});
	setObject(nowChannel_DPs.PRESSURE_MAX, {
		Name:     "gismeteo.now.PRESSURE_MAX",
		TypeName: "HSSDP",
		Parent:   nowChannel 
	});
	setObject(nowChannel_DPs.TEMPERATURE, {
		Name:     "gismeteo.now.TEMPERATURE",
		TypeName: "HSSDP",
		Parent:   nowChannel 
	});
	setObject(nowChannel_DPs.HUMIDITY, {
		Name:     "gismeteo.now.HUMIDITY",
		TypeName: "HSSDP",
		Parent:   nowChannel 
	});

	// Потом сам канал сегодня
	setObject(nowChannel, {
		Name:     "gismeteo.now", // Имя канала
		TypeName: "CHANNEL",        // Важно. Говорит CCU.IO, что это канал
		Address:  "gismeteo.now",
		HssType:  "gismeteo",       // Помоему это свойство можно опустить
		DPs:      nowChannel_DPs,
		Parent:   rootDevice        // Говорит адрес корневого элемента
	});
	
	// тоже самое для завтра
	setObject(nextChannel_DPs.DATE, {
		Name:     "gismeteo.next.DATE",
		TypeName: "HSSDP", // говорит CCU.IO, что это переменная содержит реальные значения а не просто структурный элемент, т.е. это datapoint
		Parent:   nextChannel 
	});	
	setObject(nextChannel_DPs.PRESSURE_MIN, {
		Name:     "gismeteo.next.PRESSURE_MIN",
		TypeName: "HSSDP", // говорит CCU.IO, что это переменная содержит реальные значения а не просто структурный элемент, т.е. это datapoint
		Parent:   nextChannel 
	});
	setObject(nextChannel_DPs.PRESSURE_MAX, {
		Name:     "gismeteo.next.PRESSURE_MAX",
		TypeName: "HSSDP", // говорит CCU.IO, что это переменная содержит реальные значения а не просто структурный элемент, т.е. это datapoint
		Parent:   nextChannel 
	});
	setObject(nextChannel_DPs.TEMPERATURE, {
		Name:     "gismeteo.next.TEMPERATURE",
		TypeName: "HSSDP", // говорит CCU.IO, что это переменная содержит реальные значения а не просто структурный элемент, т.е. это datapoint
		Parent:   nextChannel 
	});
	setObject(nextChannel_DPs.HUMIDITY, {
		Name:     "gismeteo.next.HUMIDITY",
		TypeName: "HSSDP", // говорит CCU.IO, что это переменная содержит реальные значения а не просто структурный элемент, т.е. это datapoint
		Parent:   nextChannel 
	});

	// Потом сам канал сегодня
	setObject(nextChannel, {
		Name:     "gismeteo.next", // Имя канала
		TypeName: "CHANNEL",        // Важно. Говорит CCU.IO, что это канал
		Address:  "gismeteo.next",
		HssType:  "gismeteo",       // Помоему это свойство можно опустить
		DPs:      nextChannel_DPs,
		Parent:   rootDevice        // Говорит адрес корневого элемента
	});	
	
	// И напоследок корневой элемент
	setObject(rootDevice, {
		Name:      "gismeteo",
		TypeName:  "DEVICE",
		HssType:   "gismeteo_ROOT",
		Address:   "gismeteo",
		Interface: "CCU.IO",
		Channels:  [      // Массив с адресами каналов
			nowChannel,
			nextChannel
		]
	});
	
	// Выполняем один раз опрос
	pollGismeteo();
	
	// и запускаем таймер
    pollTimer = setInterval(pollGismeteo, gismeteoSettings.pollIntervalHours * 3600000 /* ms */);
}

// запрашиваем объект 
function getXmlResponse(callback) {
    var options = {
        host: 'informer.gismeteo.com',
        port: 80,
        path: '/xml/' + gismeteoSettings.cityId + '_1.xml'
    };

    console.log('http://informer.gismeteo.com/xml/' + gismeteoSettings.cityId + '_1.xml');

    http.get(options, function(res) {
        var xmldata = '';
        res.setEncoding('utf8');
        res.on('error', function (e) {
            logger.warn ("currency: " + e);
        });
        res.on('data', function(chunk){
            xmldata += chunk;
        });
        res.on('end', function () {
            // Analyse answer and updates staties
            if (callback) {
                parseString(xmldata, function (err, data) {
                    var result = null;
                    if (!err && data) {
                        try {
							// я не знаю точно, какой объект вернет парсер XML, 
							// поэтому я сначала вывожу в консоли его структуру командой: console.log(JSON.stringify(data, "", " "));
							// получаем
							// {
							//  "MMWEATHER": {
							//   "REPORT": [
							//    {
							//     "$": {
							//      "type": "frc3"
							//     },
							//     "TOWN": [
							//      {
							//       "$": {
							//        "index": "28722",
							//        "sname": "%D3%F4%E0",
							//        "latitude": "54",
							//        "longitude": "55"
							//       },
							//       "FORECAST": [
							//        {
							//         "$": {
							//          "day": "17",
							//          "month": "06",
							//          "year": "2014",
							//          "hour": "03",
							//          "tod": "0",
							//          "predict": "0",
							//          "weekday": "3"
							//         },
							//         "PHENOMENA": [
							//          {
							//           "$": {
							//            "cloudiness": "1",
							//            "precipitation": "10",
							//            "rpower": "0",
							//            "spower": "0"
							//           }
							//          }
							//         ],
							//         "PRESSURE": [
							//          {
							//           "$": {
							//            "max": "746",
							//            "min": "744"
							//           }
							//          }
							//         ],
							//         "TEMPERATURE": [
							//          {
							//           "$": {
							//            "max": "11",
							//            "min": "9"
							//           }
							//          }
							//         ],
							//         "WIND": [
							//          {
							//           "$": {
							//            "min": "-1",
							//            "max": "1",
							//            "direction": "1"
							//           }
							//          }
							//         ],
							//         "RELWET": [
							//          {
							//           "$": {
							//            "max": "93",
							//            "min": "91"
							//           }
							//          }
							//         ],
							//         "HEAT": [
							//          {
							//           "$": {
							//            "min": "9",
							//            "max": "11"
							//           }
							//          }
							//         ]
							//        },
							//        {
							//         "$": {
							//          "day": "17",
							//          "month": "06",
							//          "year": "2014",
							//          "hour": "09",
							//          "tod": "1",
							//          "predict": "0",
							//          "weekday": "3"
							//         },
							//         "PHENOMENA": [
							//          {
							//           "$": {
							//            "cloudiness": "0",
							//            "precipitation": "10",
							//            "rpower": "0",
							//            "spower": "0"
							//           }
							//          }
							//         ],
							//         "PRESSURE": [
							//          {
							//           "$": {
							//            "max": "747",
							//            "min": "745"
							//           }
							//          }
							//         ],
							//         "TEMPERATURE": [
							//          {
							//           "$": {
							//            "max": "15",
							//            "min": "13"
							//           }
							//          }
							//         ],
							//         "WIND": [
							//          {
							//           "$": {
							//            "min": "0",
							//            "max": "2",
							//            "direction": "5"
							//           }
							//          }
							//         ],
							//         "RELWET": [
							//          {
							//           "$": {
							//            "max": "85",
							//            "min": "83"
							//           }
							//          }
							//         ],
							//         "HEAT": [
							//          {
							//           "$": {
							//            "min": "13",
							//            "max": "15"
							//           }
							//          }
							//         ]
							//        },
							//        {
							//         "$": {
							//          "day": "17",
							//          "month": "06",
							//          "year": "2014",
							//          "hour": "15",
							//          "tod": "2",
							//          "predict": "0",
							//          "weekday": "3"
							//         },
							//         "PHENOMENA": [
							//          {
							//           "$": {
							//            "cloudiness": "2",
							//            "precipitation": "10",
							//            "rpower": "0",
							//            "spower": "0"
							//           }
							//          }
							//         ],
							//         "PRESSURE": [
							//          {
							//           "$": {
							//            "max": "748",
							//            "min": "746"
							//           }
							//          }
							//         ],
							//         "TEMPERATURE": [
							//          {
							//           "$": {
							//            "max": "20",
							//            "min": "18"
							//           }
							//          }
							//         ],
							//         "WIND": [
							//          {
							//           "$": {
							//            "min": "3",
							//            "max": "5",
							//            "direction": "5"
							//           }
							//          }
							//         ],
							//         "RELWET": [
							//          {
							//           "$": {
							//            "max": "54",
							//            "min": "52"
							//           }
							//          }
							//         ],
							//         "HEAT": [
							//          {
							//           "$": {
							//            "min": "18",
							//            "max": "20"
							//           }
							//          }
							//         ]
							//        },
							//        {
							//         "$": {
							//          "day": "17",
							//          "month": "06",
							//          "year": "2014",
							//          "hour": "21",
							//          "tod": "3",
							//          "predict": "0",
							//          "weekday": "3"
							//         },
							//         "PHENOMENA": [
							//          {
							//           "$": {
							//            "cloudiness": "2",
							//            "precipitation": "10",
							//            "rpower": "0",
							//            "spower": "0"
							//           }
							//          }
							//         ],
							//         "PRESSURE": [
							//          {
							//           "$": {
							//            "max": "749",
							//            "min": "747"
							//           }
							//          }
							//         ],
							//         "TEMPERATURE": [
							//          {
							//           "$": {
							//            "max": "19",
							//            "min": "17"
							//           }
							//          }
							//         ],
							//         "WIND": [
							//          {
							//           "$": {
							//            "min": "0",
							//            "max": "2",
							//            "direction": "6"
							//           }
							//          }
							//         ],
							//         "RELWET": [
							//          {
							//           "$": {
							//            "max": "60",
							//            "min": "58"
							//           }
							//          }
							//         ],
							//         "HEAT": [
							//          {
							//           "$": {
							//            "min": "17",
							//            "max": "19"
							//           }
							//          }
							//         ]
							//        }
							//       ]
							//      }
							//     ]
							//    }
							//   ]
							//  }
							// }
							
							var list = data['MMWEATHER']['REPORT'][0]['TOWN'][0]['FORECAST']; // Можно использовать data.MMWEATHER.REPORT[0].TOWN[0].FORECAST
                            result = {};

							result['now'] = {
								DATE:         list[0].$.year + '.' + list[0]['$'].month + '.' + list[0]['$'].day,
								PRESSURE_MIN: list[0].PRESSURE[0].$.min, 
								PRESSURE_MAX: list[0].PRESSURE[0].$.max,
								TEMPERATURE:  (parseFloat(list[0].TEMPERATURE[0].$.max) + parseFloat(list[0].PRESSURE[0].$.min)) / 2, // берем значение в середине
								HUMIDITY:     (parseFloat(list[0].RELWET[0].$.max) + parseFloat(list[0].RELWET[0].$.min)) / 2        // берем значение в середине
							};
                            result['next'] = {};
							// Ищем значение для 15:00 и возьмем его, как температуру на завтра
                            for (var i = 1; i < list.length; i++) {
								if (list[i].$.hour == "15") {
									result['next'] = {
										DATE:         list[i].$.year + '.' + list[i]['$'].month + '.' + list[i]['$'].day,
										PRESSURE_MIN: list[i].PRESSURE[0].$.min, 
										PRESSURE_MAX: list[i].PRESSURE[0].$.max,
										TEMPERATURE:  (parseFloat(list[i].TEMPERATURE[0].$.max) + parseFloat(list[i].PRESSURE[0].$.min)) / 2, // берем значение в середине
										HUMIDITY:     (parseFloat(list[i].RELWET[0].$.max) + parseFloat(list[i].RELWET[0].$.min)) / 2        // берем значение в середине
									};
									break;
								}
                            }
                        } catch(e) {
                            logger.warn("adapter gismeteo: cannot parse xml answer");
                        }
                        callback(result);
                    } else {
                        logger.warn("adapter gismeteo: cannot parse xml answer - " + err);
                    }
                });
            }
        });
    }).on('error', function(e) {
        logger.warn("adapter gismeteo: Got error by request " + e.message);
    });
}

// опрашивем gismeteo
function pollGismeteo () {
	getXmlResponse(function (data) {
		if (data) {
			// Передать данные для сейчас
			setState(nowChannel_DPs.DATE,         data.now.DATE);
			setState(nowChannel_DPs.PRESSURE_MIN, data.now.PRESSURE_MIN);
			setState(nowChannel_DPs.PRESSURE_MAX, data.now.PRESSURE_MAX);
			setState(nowChannel_DPs.TEMPERATURE,  data.now.TEMPERATURE);
			setState(nowChannel_DPs.HUMIDITY,     data.now.HUMIDITY);
			
			// Передать данные для завтра
			setState(nextChannel_DPs.DATE,         data.next.DATE);
			setState(nextChannel_DPs.PRESSURE_MIN, data.next.PRESSURE_MIN);
			setState(nextChannel_DPs.PRESSURE_MAX, data.next.PRESSURE_MAX);
			setState(nextChannel_DPs.TEMPERATURE,  data.next.TEMPERATURE);
			setState(nextChannel_DPs.HUMIDITY,     data.next.HUMIDITY);		
		}
	});
}

// Инициализируем драйвер
initGismeteo ();