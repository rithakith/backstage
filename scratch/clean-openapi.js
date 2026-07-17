const fs = require('fs');
const path = require('path');

const filePath = 'c:/Users/ritzy/Desktop/backstage/docs/api/catalog-backend-module-wso2-apim/openapi.yaml';
let content = fs.readFileSync(filePath, 'utf8');

// Normalize line endings to LF to perform matches reliably, then write back with whatever we want
const originalLineEndings = content.includes('\r\n') ? '\r\n' : '\n';
content = content.replace(/\r\n/g, '\n');

const startMarker = '  /api/am/publisher/v4/apis/{apiId}/wsdl:\n    get:';
const endMarker = "        '404':";

const startIndex = content.indexOf(startMarker);
if (startIndex === -1) {
  console.error('Could not find start marker');
  process.exit(1);
}

const endIndex = content.indexOf(endMarker, startIndex);
if (endIndex === -1) {
  console.error('Could not find end marker');
  process.exit(1);
}

// Let's print out what we found to verify
const targetSection = content.substring(startIndex, endIndex);
console.log('Target section length:', targetSection.length);

const wsdlContent = `<?xml version="1.0" encoding="UTF-8"?>
<definitions name="CountryInfoService" targetNamespace="http://www.oorsprong.org/websamples.countryinfo" xmlns="http://schemas.xmlsoap.org/wsdl/" xmlns:tns="http://www.oorsprong.org/websamples.countryinfo" xmlns:soap12="http://schemas.xmlsoap.org/wsdl/soap12/" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/">
  <types>
    <xs:schema elementFormDefault="qualified" targetNamespace="http://www.oorsprong.org/websamples.countryinfo">
      <xs:complexType name="tContinent">
        <xs:sequence>
          <xs:element name="sCode" type="xs:string"/>
          <xs:element name="sName" type="xs:string"/>
        </xs:sequence>
      </xs:complexType>
      <xs:complexType name="tCurrency">
        <xs:sequence>
          <xs:element name="sISOCode" type="xs:string"/>
          <xs:element name="sName" type="xs:string"/>
        </xs:sequence>
      </xs:complexType>
      <xs:complexType name="tCountryCodeAndName">
        <xs:sequence>
          <xs:element name="sISOCode" type="xs:string"/>
          <xs:element name="sName" type="xs:string"/>
        </xs:sequence>
      </xs:complexType>
      <xs:complexType name="tCountryCodeAndNameGroupedByContinent">
        <xs:sequence>
          <xs:element name="Continent" type="tns:tContinent"/>
          <xs:element name="CountryCodeAndNames" type="tns:ArrayOftCountryCodeAndName"/>
        </xs:sequence>
      </xs:complexType>
      <xs:complexType name="tCountryInfo">
        <xs:sequence>
          <xs:element name="sISOCode" type="xs:string"/>
          <xs:element name="sName" type="xs:string"/>
          <xs:element name="sCapitalCity" type="xs:string"/>
          <xs:element name="sPhoneCode" type="xs:string"/>
          <xs:element name="sContinentCode" type="xs:string"/>
          <xs:element name="sCurrencyISOCode" type="xs:string"/>
          <xs:element name="sCountryFlag" type="xs:string"/>
          <xs:element name="Languages" type="tns:ArrayOftLanguage"/>
        </xs:sequence>
      </xs:complexType>
      <xs:complexType name="tLanguage">
        <xs:sequence>
          <xs:element name="sISOCode" type="xs:string"/>
          <xs:element name="sName" type="xs:string"/>
        </xs:sequence>
      </xs:complexType>
      <xs:complexType name="ArrayOftCountryCodeAndName">
        <xs:sequence>
          <xs:element maxOccurs="unbounded" minOccurs="0" name="tCountryCodeAndName" nillable="true" type="tns:tCountryCodeAndName"/>
        </xs:sequence>
      </xs:complexType>
      <xs:complexType name="ArrayOftLanguage">
        <xs:sequence>
          <xs:element maxOccurs="unbounded" minOccurs="0" name="tLanguage" nillable="true" type="tns:tLanguage"/>
        </xs:sequence>
      </xs:complexType>
      <xs:complexType name="ArrayOftContinent">
        <xs:sequence>
          <xs:element maxOccurs="unbounded" minOccurs="0" name="tContinent" nillable="true" type="tns:tContinent"/>
        </xs:sequence>
      </xs:complexType>
      <xs:complexType name="ArrayOftCurrency">
        <xs:sequence>
          <xs:element maxOccurs="unbounded" minOccurs="0" name="tCurrency" nillable="true" type="tns:tCurrency"/>
        </xs:sequence>
      </xs:complexType>
      <xs:complexType name="ArrayOftCountryCodeAndNameGroupedByContinent">
        <xs:sequence>
          <xs:element maxOccurs="unbounded" minOccurs="0" name="tCountryCodeAndNameGroupedByContinent" nillable="true" type="tns:tCountryCodeAndNameGroupedByContinent"/>
        </xs:sequence>
      </xs:complexType>
      <xs:complexType name="ArrayOftCountryInfo">
        <xs:sequence>
          <xs:element maxOccurs="unbounded" minOccurs="0" name="tCountryInfo" nillable="true" type="tns:tCountryInfo"/>
        </xs:sequence>
      </xs:complexType>
      <xs:element name="ListOfContinentsByName">
        <xs:complexType>
          <xs:sequence/>
        </xs:complexType>
      </xs:element>
      <xs:element name="ListOfContinentsByNameResponse">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="ListOfContinentsByNameResult" type="tns:ArrayOftContinent"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
      <xs:element name="ListOfContinentsByCode">
        <xs:complexType>
          <xs:sequence/>
        </xs:complexType>
      </xs:element>
      <xs:element name="ListOfContinentsByCodeResponse">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="ListOfContinentsByCodeResult" type="tns:ArrayOftContinent"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
      <xs:element name="ListOfCurrenciesByName">
        <xs:complexType>
          <xs:sequence/>
        </xs:complexType>
      </xs:element>
      <xs:element name="ListOfCurrenciesByNameResponse">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="ListOfCurrenciesByNameResult" type="tns:ArrayOftCurrency"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
      <xs:element name="ListOfCurrenciesByCode">
        <xs:complexType>
          <xs:sequence/>
        </xs:complexType>
      </xs:element>
      <xs:element name="ListOfCurrenciesByCodeResponse">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="ListOfCurrenciesByCodeResult" type="tns:ArrayOftCurrency"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
      <xs:element name="CurrencyName">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="sCurrencyISOCode" type="xs:string"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
      <xs:element name="CurrencyNameResponse">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="CurrencyNameResult" type="xs:string"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
      <xs:element name="ListOfCountryNamesByCode">
        <xs:complexType>
          <xs:sequence/>
        </xs:complexType>
      </xs:element>
      <xs:element name="ListOfCountryNamesByCodeResponse">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="ListOfCountryNamesByCodeResult" type="tns:ArrayOftCountryCodeAndName"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
      <xs:element name="ListOfCountryNamesByName">
        <xs:complexType>
          <xs:sequence/>
        </xs:complexType>
      </xs:element>
      <xs:element name="ListOfCountryNamesByNameResponse">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="ListOfCountryNamesByNameResult" type="tns:ArrayOftCountryCodeAndName"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
      <xs:element name="ListOfCountryNamesGroupedByContinent">
        <xs:complexType>
          <xs:sequence/>
        </xs:complexType>
      </xs:element>
      <xs:element name="ListOfCountryNamesGroupedByContinentResponse">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="ListOfCountryNamesGroupedByContinentResult" type="tns:ArrayOftCountryCodeAndNameGroupedByContinent"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
      <xs:element name="CountryName">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="sCountryISOCode" type="xs:string"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
      <xs:element name="CountryNameResponse">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="CountryNameResult" type="xs:string"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
      <xs:element name="CountryISOCode">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="sCountryName" type="xs:string"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
      <xs:element name="CountryISOCodeResponse">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="CountryISOCodeResult" type="xs:string"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
      <xs:element name="CapitalCity">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="sCountryISOCode" type="xs:string"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
      <xs:element name="CapitalCityResponse">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="CapitalCityResult" type="xs:string"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
      <xs:element name="CountryCurrency">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="sCountryISOCode" type="xs:string"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
      <xs:element name="CountryCurrencyResponse">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="CountryCurrencyResult" type="tns:tCurrency"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
      <xs:element name="CountryFlag">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="sCountryISOCode" type="xs:string"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
      <xs:element name="CountryFlagResponse">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="CountryFlagResult" type="xs:string"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
      <xs:element name="CountryIntPhoneCode">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="sCountryISOCode" type="xs:string"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
      <xs:element name="CountryIntPhoneCodeResponse">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="CountryIntPhoneCodeResult" type="xs:string"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
      <xs:element name="FullCountryInfo">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="sCountryISOCode" type="xs:string"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
      <xs:element name="FullCountryInfoResponse">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="FullCountryInfoResult" type="tns:tCountryInfo"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
      <xs:element name="FullCountryInfoAllCountries">
        <xs:complexType>
          <xs:sequence/>
        </xs:complexType>
      </xs:element>
      <xs:element name="FullCountryInfoAllCountriesResponse">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="FullCountryInfoAllCountriesResult" type="tns:ArrayOftCountryInfo"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
      <xs:element name="CountriesUsingCurrency">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="sISOCurrencyCode" type="xs:string"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
      <xs:element name="CountriesUsingCurrencyResponse">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="CountriesUsingCurrencyResult" type="tns:ArrayOftCountryCodeAndName"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
      <xs:element name="ListOfLanguagesByName">
        <xs:complexType>
          <xs:sequence/>
        </xs:complexType>
      </xs:element>
      <xs:element name="ListOfLanguagesByNameResponse">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="ListOfLanguagesByNameResult" type="tns:ArrayOftLanguage"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
      <xs:element name="ListOfLanguagesByCode">
        <xs:complexType>
          <xs:sequence/>
        </xs:complexType>
      </xs:element>
      <xs:element name="ListOfLanguagesByCodeResponse">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="ListOfLanguagesByCodeResult" type="tns:ArrayOftLanguage"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
      <xs:element name="LanguageName">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="sISOCode" type="xs:string"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
      <xs:element name="LanguageNameResponse">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="LanguageNameResult" type="xs:string"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
      <xs:element name="LanguageISOCode">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="sLanguageName" type="xs:string"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
      <xs:element name="LanguageISOCodeResponse">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="LanguageISOCodeResult" type="xs:string"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
    </xs:schema>
  </types>
  <message name="LanguageNameSoapRequest">
    <part name="parameters" element="tns:LanguageName">
    </part>
  </message>
  <message name="ListOfCurrenciesByNameSoapRequest">
    <part name="parameters" element="tns:ListOfCurrenciesByName">
    </part>
  </message>
  <message name="LanguageNameSoapResponse">
    <part name="parameters" element="tns:LanguageNameResponse">
    </part>
  </message>
  <message name="ListOfContinentsByCodeSoapResponse">
    <part name="parameters" element="tns:ListOfContinentsByCodeResponse">
    </part>
  </message>
  <message name="CountryFlagSoapResponse">
    <part name="parameters" element="tns:CountryFlagResponse">
    </part>
  </message>
  <message name="CurrencyNameSoapResponse">
    <part name="parameters" element="tns:CurrencyNameResponse">
    </part>
  </message>
  <message name="ListOfLanguagesByNameSoapRequest">
    <part name="parameters" element="tns:ListOfLanguagesByName">
    </part>
  </message>
  <message name="ListOfCountryNamesByNameSoapRequest">
    <part name="parameters" element="tns:ListOfCountryNamesByName">
    </part>
  </message>
  <message name="CapitalCitySoapRequest">
    <part name="parameters" element="tns:CapitalCity">
    </part>
  </message>
  <message name="ListOfCurrenciesByCodeSoapRequest">
    <part name="parameters" element="tns:ListOfCurrenciesByCode">
    </part>
  </message>
  <message name="ListOfLanguagesByCodeSoapRequest">
    <part name="parameters" element="tns:ListOfLanguagesByCode">
    </part>
  </message>
  <message name="ListOfCountryNamesByCodeSoapRequest">
    <part name="parameters" element="tns:ListOfCountryNamesByCode">
    </part>
  </message>
  <message name="CountriesUsingCurrencySoapResponse">
    <part name="parameters" element="tns:CountriesUsingCurrencyResponse">
    </part>
  </message>
  <message name="ListOfContinentsByCodeSoapRequest">
    <part name="parameters" element="tns:ListOfContinentsByCode">
    </part>
  </message>
  <message name="ListOfCurrenciesByCodeSoapResponse">
    <part name="parameters" element="tns:ListOfCurrenciesByCodeResponse">
    </part>
  </message>
  <message name="FullCountryInfoAllCountriesSoapRequest">
    <part name="parameters" element="tns:FullCountryInfoAllCountries">
    </part>
  </message>
  <message name="CountryFlagSoapRequest">
    <part name="parameters" element="tns:CountryFlag">
    </part>
  </message>
  <message name="LanguageISOCodeSoapRequest">
    <part name="parameters" element="tns:LanguageISOCode">
    </part>
  </message>
  <message name="CountryISOCodeSoapRequest">
    <part name="parameters" element="tns:CountryISOCode">
    </part>
  </message>
  <message name="ListOfCountryNamesGroupedByContinentSoapResponse">
    <part name="parameters" element="tns:ListOfCountryNamesGroupedByContinentResponse">
    </part>
  </message>
  <message name="FullCountryInfoAllCountriesSoapResponse">
    <part name="parameters" element="tns:FullCountryInfoAllCountriesResponse">
    </part>
  </message>
  <message name="CountryCurrencySoapRequest">
    <part name="parameters" element="tns:CountryCurrency">
    </part>
  </message>
  <message name="CountryIntPhoneCodeSoapRequest">
    <part name="parameters" element="tns:CountryIntPhoneCode">
    </part>
  </message>
  <message name="ListOfLanguagesByCodeSoapResponse">
    <part name="parameters" element="tns:ListOfLanguagesByCodeResponse">
    </part>
  </message>
  <message name="ListOfCurrenciesByNameSoapResponse">
    <part name="parameters" element="tns:ListOfCurrenciesByNameResponse">
    </part>
  </message>
  <message name="CountryIntPhoneCodeSoapResponse">
    <part name="parameters" element="tns:CountryIntPhoneCodeResponse">
    </part>
  </message>
  <message name="CountriesUsingCurrencySoapRequest">
    <part name="parameters" element="tns:CountriesUsingCurrency">
    </part>
  </message>
  <message name="CurrencyNameSoapRequest">
    <part name="parameters" element="tns:CurrencyName">
    </part>
  </message>
  <message name="CountryNameSoapResponse">
    <part name="parameters" element="tns:CountryNameResponse">
    </part>
  </message>
  <message name="CountryNameSoapRequest">
    <part name="parameters" element="tns:CountryName">
    </part>
  </message>
  <message name="CountryCurrencySoapResponse">
    <part name="parameters" element="tns:CountryCurrencyResponse">
    </part>
  </message>
  <message name="FullCountryInfoSoapResponse">
    <part name="parameters" element="tns:FullCountryInfoResponse">
    </part>
  </message>
  <message name="ListOfContinentsByNameSoapRequest">
    <part name="parameters" element="tns:ListOfContinentsByName">
    </part>
  </message>
  <message name="ListOfLanguagesByNameSoapResponse">
    <part name="parameters" element="tns:ListOfLanguagesByNameResponse">
    </part>
  </message>
  <message name="ListOfContinentsByNameSoapResponse">
    <part name="parameters" element="tns:ListOfContinentsByNameResponse">
    </part>
  </message>
  <message name="ListOfCountryNamesByNameSoapResponse">
    <part name="parameters" element="tns:ListOfCountryNamesByNameResponse">
    </part>
  </message>
  <message name="CapitalCitySoapResponse">
    <part name="parameters" element="tns:CapitalCityResponse">
    </part>
  </message>
  <message name="LanguageISOCodeSoapResponse">
    <part name="parameters" element="tns:LanguageISOCodeResponse">
    </part>
  </message>
  <message name="ListOfCountryNamesByCodeSoapResponse">
    <part name="parameters" element="tns:ListOfCountryNamesByCodeResponse">
    </part>
  </message>
  <message name="FullCountryInfoSoapRequest">
    <part name="parameters" element="tns:FullCountryInfo">
    </part>
  </message>
  <message name="ListOfCountryNamesGroupedByContinentSoapRequest">
    <part name="parameters" element="tns:ListOfCountryNamesGroupedByContinent">
    </part>
  </message>
  <message name="CountryISOCodeSoapResponse">
    <part name="parameters" element="tns:CountryISOCodeResponse">
    </part>
  </message>
  <portType name="CountryInfoServiceSoapType">
    <operation name="ListOfContinentsByName">
      <documentation>Returns a list of continents ordered by name.</documentation>
      <input message="tns:ListOfContinentsByNameSoapRequest">
      </input>
      <output message="tns:ListOfContinentsByNameSoapResponse">
      </output>
    </operation>
    <operation name="ListOfContinentsByCode">
      <documentation>Returns a list of continents ordered by code.</documentation>
      <input message="tns:ListOfContinentsByCodeSoapRequest">
      </input>
      <output message="tns:ListOfContinentsByCodeSoapResponse">
      </output>
    </operation>
    <operation name="ListOfCurrenciesByName">
      <documentation>Returns a list of currencies ordered by name.</documentation>
      <input message="tns:ListOfCurrenciesByNameSoapRequest">
      </input>
      <output message="tns:ListOfCurrenciesByNameSoapResponse">
      </output>
    </operation>
    <operation name="ListOfCurrenciesByCode">
      <documentation>Returns a list of currencies ordered by code.</documentation>
      <input message="tns:ListOfCurrenciesByCodeSoapRequest">
      </input>
      <output message="tns:ListOfCurrenciesByCodeSoapResponse">
      </output>
    </operation>
    <operation name="CurrencyName">
      <documentation>Returns the name of the currency (if found)</documentation>
      <input message="tns:CurrencyNameSoapRequest">
      </input>
      <output message="tns:CurrencyNameSoapResponse">
      </output>
    </operation>
    <operation name="ListOfCountryNamesByCode">
      <documentation>Returns a list of all stored counties ordered by ISO code</documentation>
      <input message="tns:ListOfCountryNamesByCodeSoapRequest">
      </input>
      <output message="tns:ListOfCountryNamesByCodeSoapResponse">
      </output>
    </operation>
    <operation name="ListOfCountryNamesByName">
      <documentation>Returns a list of all stored counties ordered by country name</documentation>
      <input message="tns:ListOfCountryNamesByNameSoapRequest">
      </input>
      <output message="tns:ListOfCountryNamesByNameSoapResponse">
      </output>
    </operation>
    <operation name="ListOfCountryNamesGroupedByContinent">
      <documentation>Returns a list of all stored counties grouped per continent</documentation>
      <input message="tns:ListOfCountryNamesGroupedByContinentSoapRequest">
      </input>
      <output message="tns:ListOfCountryNamesGroupedByContinentSoapResponse">
      </output>
    </operation>
    <operation name="CountryName">
      <documentation>Searches the database for a country by the passed ISO country code</documentation>
      <input message="tns:CountryNameSoapRequest">
      </input>
      <output message="tns:CountryNameSoapResponse">
      </output>
    </operation>
    <operation name="CountryISOCode">
      <documentation>This function tries to found a country based on the passed country name.</documentation>
      <input message="tns:CountryISOCodeSoapRequest">
      </input>
      <output message="tns:CountryISOCodeSoapResponse">
      </output>
    </operation>
    <operation name="CapitalCity">
      <documentation>Returns the  name of the captial city for the passed country code</documentation>
      <input message="tns:CapitalCitySoapRequest">
      </input>
      <output message="tns:CapitalCitySoapResponse">
      </output>
    </operation>
    <operation name="CountryCurrency">
      <documentation>Returns the currency ISO code and name for the passed country ISO code</documentation>
      <input message="tns:CountryCurrencySoapRequest">
      </input>
      <output message="tns:CountryCurrencySoapResponse">
      </output>
    </operation>
    <operation name="CountryFlag">
      <documentation>Returns a link to a picture of the country flag</documentation>
      <input message="tns:CountryFlagSoapRequest">
      </input>
      <output message="tns:CountryFlagSoapResponse">
      </output>
    </operation>
    <operation name="CountryIntPhoneCode">
      <documentation>Returns the internation phone code for the passed ISO country code</documentation>
      <input message="tns:CountryIntPhoneCodeSoapRequest">
      </input>
      <output message="tns:CountryIntPhoneCodeSoapResponse">
      </output>
    </operation>
    <operation name="FullCountryInfo">
      <documentation>Returns a struct with all the stored country information. Pass the ISO country code</documentation>
      <input message="tns:FullCountryInfoSoapRequest">
      </input>
      <output message="tns:FullCountryInfoSoapResponse">
      </output>
    </operation>
    <operation name="FullCountryInfoAllCountries">
      <documentation>Returns an array with all countries and all the language information stored</documentation>
      <input message="tns:FullCountryInfoAllCountriesSoapRequest">
      </input>
      <output message="tns:FullCountryInfoAllCountriesSoapResponse">
      </output>
    </operation>
    <operation name="CountriesUsingCurrency">
      <documentation>Returns a list of all countries that use the same currency code. Pass a ISO currency code</documentation>
      <input message="tns:CountriesUsingCurrencySoapRequest">
      </input>
      <output message="tns:CountriesUsingCurrencySoapResponse">
      </output>
    </operation>
    <operation name="ListOfLanguagesByName">
      <documentation>Returns an array of languages ordered by name</documentation>
      <input message="tns:ListOfLanguagesByNameSoapRequest">
      </input>
      <output message="tns:ListOfLanguagesByNameSoapResponse">
      </output>
    </operation>
    <operation name="ListOfLanguagesByCode">
      <documentation>Returns an array of languages ordered by code</documentation>
      <input message="tns:ListOfLanguagesByCodeSoapRequest">
      </input>
      <output message="tns:ListOfLanguagesByCodeSoapResponse">
      </output>
    </operation>
    <operation name="LanguageName">
      <documentation>Find a language name based on the passed ISO language code</documentation>
      <input message="tns:LanguageNameSoapRequest">
      </input>
      <output message="tns:LanguageNameSoapResponse">
      </output>
    </operation>
    <operation name="LanguageISOCode">
      <documentation>Find a language ISO code based on the passed language name</documentation>
      <input message="tns:LanguageISOCodeSoapRequest">
      </input>
      <output message="tns:LanguageISOCodeSoapResponse">
      </output>
    </operation>
  </portType>
  <binding name="CountryInfoServiceSoapBinding" type="tns:CountryInfoServiceSoapType">
    <soap:binding style="document" transport="http://schemas.xmlsoap.org/soap/http"/>
    <operation name="ListOfContinentsByName">
      <soap:operation soapAction="" style="document"/>
      <input>
        <soap:body use="literal"/>
      </input>
      <output>
        <soap:body use="literal"/>
      </output>
    </operation>
    <operation name="ListOfContinentsByCode">
      <soap:operation soapAction="" style="document"/>
      <input>
        <soap:body use="literal"/>
      </input>
      <output>
        <soap:body use="literal"/>
      </output>
    </operation>
    <operation name="ListOfCurrenciesByName">
      <soap:operation soapAction="" style="document"/>
      <input>
        <soap:body use="literal"/>
      </input>
      <output>
        <soap:body use="literal"/>
      </output>
    </operation>
    <operation name="ListOfCurrenciesByCode">
      <soap:operation soapAction="" style="document"/>
      <input>
        <soap:body use="literal"/>
      </input>
      <output>
        <soap:body use="literal"/>
      </output>
    </operation>
    <operation name="CurrencyName">
      <soap:operation soapAction="" style="document"/>
      <input>
        <soap:body use="literal"/>
      </input>
      <output>
        <soap:body use="literal"/>
      </output>
    </operation>
    <operation name="ListOfCountryNamesByCode">
      <soap:operation soapAction="" style="document"/>
      <input>
        <soap:body use="literal"/>
      </input>
      <output>
        <soap:body use="literal"/>
      </output>
    </operation>
    <operation name="ListOfCountryNamesByName">
      <soap:operation soapAction="" style="document"/>
      <input>
        <soap:body use="literal"/>
      </input>
      <output>
        <soap:body use="literal"/>
      </output>
    </operation>
    <operation name="ListOfCountryNamesGroupedByContinent">
      <soap:operation soapAction="" style="document"/>
      <input>
        <soap:body use="literal"/>
      </input>
      <output>
        <soap:body use="literal"/>
      </output>
    </operation>
    <operation name="CountryName">
      <soap:operation soapAction="" style="document"/>
      <input>
        <soap:body use="literal"/>
      </input>
      <output>
        <soap:body use="literal"/>
      </output>
    </operation>
    <operation name="CountryISOCode">
      <soap:operation soapAction="" style="document"/>
      <input>
        <soap:body use="literal"/>
      </input>
      <output>
        <soap:body use="literal"/>
      </output>
    </operation>
    <operation name="CapitalCity">
      <soap:operation soapAction="" style="document"/>
      <input>
        <soap:body use="literal"/>
      </input>
      <output>
        <soap:body use="literal"/>
      </output>
    </operation>
    <operation name="CountryCurrency">
      <soap:operation soapAction="" style="document"/>
      <input>
        <soap:body use="literal"/>
      </input>
      <output>
        <soap:body use="literal"/>
      </output>
    </operation>
    <operation name="CountryFlag">
      <soap:operation soapAction="" style="document"/>
      <input>
        <soap:body use="literal"/>
      </input>
      <output>
        <soap:body use="literal"/>
      </output>
    </operation>
    <operation name="CountryIntPhoneCode">
      <soap:operation soapAction="" style="document"/>
      <input>
        <soap:body use="literal"/>
      </input>
      <output>
        <soap:body use="literal"/>
      </output>
    </operation>
    <operation name="FullCountryInfo">
      <soap:operation soapAction="" style="document"/>
      <input>
        <soap:body use="literal"/>
      </input>
      <output>
        <soap:body use="literal"/>
      </output>
    </operation>
    <operation name="FullCountryInfoAllCountries">
      <soap:operation soapAction="" style="document"/>
      <input>
        <soap:body use="literal"/>
      </input>
      <output>
        <soap:body use="literal"/>
      </output>
    </operation>
    <operation name="CountriesUsingCurrency">
      <soap:operation soapAction="" style="document"/>
      <input>
        <soap:body use="literal"/>
      </input>
      <output>
        <soap:body use="literal"/>
      </output>
    </operation>
    <operation name="ListOfLanguagesByName">
      <soap:operation soapAction="" style="document"/>
      <input>
        <soap:body use="literal"/>
      </input>
      <output>
        <soap:body use="literal"/>
      </output>
    </operation>
    <operation name="ListOfLanguagesByCode">
      <soap:operation soapAction="" style="document"/>
      <input>
        <soap:body use="literal"/>
      </input>
      <output>
        <soap:body use="literal"/>
      </output>
    </operation>
    <operation name="LanguageName">
      <soap:operation soapAction="" style="document"/>
      <input>
        <soap:body use="literal"/>
      </input>
      <output>
        <soap:body use="literal"/>
      </output>
    </operation>
    <operation name="LanguageISOCode">
      <soap:operation soapAction="" style="document"/>
      <input>
        <soap:body use="literal"/>
      </input>
      <output>
        <soap:body use="literal"/>
      </output>
    </operation>
  </binding>
  <binding name="CountryInfoServiceSoapBinding12" type="tns:CountryInfoServiceSoapType">
    <soap12:binding style="document" transport="http://schemas.xmlsoap.org/soap/http"/>
    <operation name="ListOfContinentsByName">
      <soap12:operation soapAction="" style="document"/>
      <input>
        <soap12:body use="literal"/>
      </input>
      <output>
        <soap12:body use="literal"/>
      </output>
    </operation>
    <operation name="ListOfContinentsByCode">
      <soap12:operation soapAction="" style="document"/>
      <input>
        <soap12:body use="literal"/>
      </input>
      <output>
        <soap12:body use="literal"/>
      </output>
    </operation>
    <operation name="ListOfCurrenciesByName">
      <soap12:operation soapAction="" style="document"/>
      <input>
        <soap12:body use="literal"/>
      </input>
      <output>
        <soap12:body use="literal"/>
      </output>
    </operation>
    <operation name="ListOfCurrenciesByCode">
      <soap12:operation soapAction="" style="document"/>
      <input>
        <soap12:body use="literal"/>
      </input>
      <output>
        <soap12:body use="literal"/>
      </output>
    </operation>
    <operation name="CurrencyName">
      <soap12:operation soapAction="" style="document"/>
      <input>
        <soap12:body use="literal"/>
      </input>
      <output>
        <soap12:body use="literal"/>
      </output>
    </operation>
    <operation name="ListOfCountryNamesByCode">
      <soap12:operation soapAction="" style="document"/>
      <input>
        <soap12:body use="literal"/>
      </input>
      <output>
        <soap12:body use="literal"/>
      </output>
    </operation>
    <operation name="ListOfCountryNamesByName">
      <soap12:operation soapAction="" style="document"/>
      <input>
        <soap12:body use="literal"/>
      </input>
      <output>
        <soap12:body use="literal"/>
      </output>
    </operation>
    <operation name="ListOfCountryNamesGroupedByContinent">
      <soap12:operation soapAction="" style="document"/>
      <input>
        <soap12:body use="literal"/>
      </input>
      <output>
        <soap12:body use="literal"/>
      </output>
    </operation>
    <operation name="CountryName">
      <soap12:operation soapAction="" style="document"/>
      <input>
        <soap12:body use="literal"/>
      </input>
      <output>
        <soap12:body use="literal"/>
      </output>
    </operation>
    <operation name="CountryISOCode">
      <soap12:operation soapAction="" style="document"/>
      <input>
        <soap12:body use="literal"/>
      </input>
      <output>
        <soap12:body use="literal"/>
      </output>
    </operation>
    <operation name="CapitalCity">
      <soap12:operation soapAction="" style="document"/>
      <input>
        <soap12:body use="literal"/>
      </input>
      <output>
        <soap12:body use="literal"/>
      </output>
    </operation>
    <operation name="CountryCurrency">
      <soap12:operation soapAction="" style="document"/>
      <input>
        <soap12:body use="literal"/>
      </input>
      <output>
        <soap12:body use="literal"/>
      </output>
    </operation>
    <operation name="CountryFlag">
      <soap12:operation soapAction="" style="document"/>
      <input>
        <soap12:body use="literal"/>
      </input>
      <output>
        <soap12:body use="literal"/>
      </output>
    </operation>
    <operation name="CountryIntPhoneCode">
      <soap12:operation soapAction="" style="document"/>
      <input>
        <soap12:body use="literal"/>
      </input>
      <output>
        <soap12:body use="literal"/>
      </output>
    </operation>
    <operation name="FullCountryInfo">
      <soap12:operation soapAction="" style="document"/>
      <input>
        <soap12:body use="literal"/>
      </input>
      <output>
        <soap12:body use="literal"/>
      </output>
    </operation>
    <operation name="FullCountryInfoAllCountries">
      <soap12:operation soapAction="" style="document"/>
      <input>
        <soap12:body use="literal"/>
      </input>
      <output>
        <soap12:body use="literal"/>
      </output>
    </operation>
    <operation name="CountriesUsingCurrency">
      <soap12:operation soapAction="" style="document"/>
      <input>
        <soap12:body use="literal"/>
      </input>
      <output>
        <soap12:body use="literal"/>
      </output>
    </operation>
    <operation name="ListOfLanguagesByName">
      <soap12:operation soapAction="" style="document"/>
      <input>
        <soap12:body use="literal"/>
      </input>
      <output>
        <soap12:body use="literal"/>
      </output>
    </operation>
    <operation name="ListOfLanguagesByCode">
      <soap12:operation soapAction="" style="document"/>
      <input>
        <soap12:body use="literal"/>
      </input>
      <output>
        <soap12:body use="literal"/>
      </output>
    </operation>
    <operation name="LanguageName">
      <soap12:operation soapAction="" style="document"/>
      <input>
        <soap12:body use="literal"/>
      </input>
      <output>
        <soap12:body use="literal"/>
      </output>
    </operation>
    <operation name="LanguageISOCode">
      <soap12:operation soapAction="" style="document"/>
      <input>
        <soap12:body use="literal"/>
      </input>
      <output>
        <soap12:body use="literal"/>
      </output>
    </operation>
  </binding>
  <service name="CountryInfoService">
    <documentation>This DataFlex Web Service opens up country information. 2 letter ISO codes are used for Country code. There are functions to retrieve the used Currency, Language, Capital City, Continent and Telephone code.</documentation>
    <port name="CountryInfoServiceSoap12" binding="tns:CountryInfoServiceSoapBinding12">
      <soap12:address location="http://webservices.oorsprong.org/websamples.countryinfo/CountryInfoService.wso"/>
    </port>
    <port name="CountryInfoServiceSoap" binding="tns:CountryInfoServiceSoapBinding">
      <soap:address location="http://webservices.oorsprong.org/websamples.countryinfo/CountryInfoService.wso"/>
    </port>
  </service>
</definitions>
`;

// Reformat target responses block to:
const newResponses = `      responses:
        '200':
          description: |
            API WSDL definition.
            
            Returns the WSDL definition for SOAP and SOAP-to-REST APIs. Can be returned as a plain XML document or as a ZIP file.
          content:
            application/wsdl+xml:
              schema:
                type: string
              examples:
                CountryInfoService:
                  $ref: '#/components/examples/CountryInfoServiceWsdl'
            text/xml:
              schema:
                type: string
              examples:
                CountryInfoService:
                  $ref: '#/components/examples/CountryInfoServiceWsdl'
            application/xml:
              schema:
                type: string
              examples:
                CountryInfoService:
                  $ref: '#/components/examples/CountryInfoServiceWsdl'
            application/zip:
              schema:
                type: string
                format: binary
            text/plain:
              schema:
                type: string
              examples:
                CountryInfoService:
                  $ref: '#/components/examples/CountryInfoServiceWsdl'
`;

// Replace target section
content = content.replace(targetSection, '  /api/am/publisher/v4/apis/{apiId}/wsdl:\n    get:\n' + newResponses);

// Now we need to append components/examples/CountryInfoServiceWsdl.
// Indent WSDL content by 8 spaces
const indentedWsdl = wsdlContent.split('\n').map(line => '        ' + line).join('\n');

const examplesSection = `\n  examples:
    CountryInfoServiceWsdl:
      summary: CountryInfoService WSDL Example
      value: |
${indentedWsdl}
`;

// We need to insert examples Section under components:.
// Let's find 'components:' in the file.
const componentsIndex = content.indexOf('components:');
if (componentsIndex === -1) {
  console.error('Could not find components:');
  process.exit(1);
}

// Let's insert it right after components: (on the next line)
const insertionPoint = content.indexOf('\n', componentsIndex) + 1;
content = content.substring(0, insertionPoint) + examplesSection + content.substring(insertionPoint);

// Restore original line endings if CRLF
if (originalLineEndings === '\r\n') {
  content = content.replace(/\n/g, '\r\n');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated openapi.yaml');
