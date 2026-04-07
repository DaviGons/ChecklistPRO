import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect } from 'react';
import { ScrollView, Text, View, Platform, TextInput, TouchableOpacity, Linking, Alert, Image, Modal, KeyboardAvoidingView } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Trash2 } from 'lucide-react-native';

import { Accordion } from './src/components/Accordion';
import { ChecklistItem, StatusType } from './src/components/ChecklistItem';
import { SelectInput } from './src/components/SelectInput';
import { generateHTMLReport } from './src/utils/pdfTemplate';
import { AuthScreen } from './src/screens/AuthScreen';

type ItemState = {
  status: StatusType;
  observation: string;
};

type ChecklistState = {
  [category: string]: {
    [itemName: string]: ItemState;
  };
};

type HeaderData = {
  placa: string;
  km: string;
  marca: string;
  modelo: string;
  ano: string;
  cor: string;
  dono: string;
  mecanico: string;
};

type PhotoData = {
  uri: string;
  base64: string;
};

const initialState: ChecklistState = {
  'Externa': {
    'Pneus': { status: 'pendente', observation: '' },
    'Rodas': { status: 'pendente', observation: '' },
    'Pintura': { status: 'pendente', observation: '' },
    'Carroceria': { status: 'pendente', observation: '' },
  },
  'Luzes': {
    'Internas': { status: 'pendente', observation: '' },
    'Externas': { status: 'pendente', observation: '' },
  },
  'Fluidos': {
    'Freio': { status: 'pendente', observation: '' },
    'Arrefecimento': { status: 'pendente', observation: '' },
    'Óleo de Motor': { status: 'pendente', observation: '' },
    'Óleo de Câmbio': { status: 'pendente', observation: '' },
    'Limpador': { status: 'pendente', observation: '' },
  },
  'Freios': {
    'Pastilhas': { status: 'pendente', observation: '' },
    'Disco': { status: 'pendente', observation: '' },
  },
  'Suspensão': {
    'Amortecedores': { status: 'pendente', observation: '' },
    'Buchas': { status: 'pendente', observation: '' },
    'Pivôs': { status: 'pendente', observation: '' },
    'Terminais': { status: 'pendente', observation: '' },
  },
  'Motor': {
    'Velas': { status: 'pendente', observation: '' },
    'Bobinas': { status: 'pendente', observation: '' },
    'Correias': { status: 'pendente', observation: '' },
    'DTC (Códigos)': { status: 'pendente', observation: '' },
  },
};

const getCategoryTheme = (category: string) => {
  switch (category) {
    case 'Externa': return 'bg-red-950/40 border-red-900/50';
    case 'Fluidos': return 'bg-orange-950/40 border-orange-900/50';
    case 'Motor': return 'bg-emerald-950/30 border-emerald-900/50';
    case 'Luzes': return 'bg-yellow-950/20 border-yellow-900/30';
    case 'Suspensão': return 'bg-blue-950/30 border-blue-900/40';
    case 'Freios': return 'bg-zinc-900 border-zinc-800';
    default: return 'bg-zinc-900 border-zinc-800';
  }
}

// Data for Dropdowns
const MARCAS = ['VW', 'GM', 'Fiat', 'Hyundai', 'Honda', 'Toyota', 'Jeep', 'Outros'];
const MODELOS: Record<string, string[]> = {
  VW: ['Gol', 'Polo', 'Nivus', 'T-Cross', 'Amarok', 'Jetta', 'Fox', 'Outros'],
  GM: ['Onix', 'Tracker', 'S10', 'Cruze', 'Montana', 'Prisma', 'Outros'],
  Fiat: ['Uno', 'Palio', 'Argo', 'Toro', 'Mobi', 'Strada', 'Outros'],
  Hyundai: ['HB20', 'Creta', 'Tucson', 'Santa Fe', 'Outros'],
  Honda: ['Civic', 'City', 'HR-V', 'Fit', 'CR-V', 'Outros'],
  Toyota: ['Corolla', 'Hilux', 'Yaris', 'RAV4', 'Corolla Cross', 'Outros'],
  Jeep: ['Renegade', 'Compass', 'Commander', 'Wrangler', 'Outros'],
};
const ANOS = Array.from({ length: 28 }, (_, i) => String(2027 - i));
ANOS.push('Antes de 2000');

function AppContent() {
  const insets = useSafeAreaInsets();
  const [currentScreen, setCurrentScreen] = useState<'identificacao' | 'checklist'>('identificacao');

  const [checklist, setChecklist] = useState<ChecklistState>(initialState);
  const [header, setHeader] = useState<HeaderData>({
    placa: '', km: '', marca: '', modelo: '', ano: '', cor: '', dono: '', mecanico: ''
  });
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [exportMethod, setExportMethod] = useState<'whatsapp' | 'pdf' | null>(null);

  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [workshopName, setWorkshopName] = useState('OFICINA CHECKLISTPRO');

  const [adminModalVisible, setAdminModalVisible] = useState(false);
  const [adminKey, setAdminKey] = useState('');

  useEffect(() => {
    const checkLicense = async () => {
      try {
        const license = await SecureStore.getItemAsync('app_license_key');
        if (license) {
          const nome = await SecureStore.getItemAsync('nome_oficina');
          if (nome) setWorkshopName(nome);
          setAuthenticated(true);
        } else {
          setAuthenticated(false);
        }
      } catch (e) {
        setAuthenticated(false);
      }
    };
    checkLicense();
  }, []);

  const confirmExport = () => {
    if (!header.mecanico || !header.mecanico.trim()) {
      return Alert.alert('Validação', 'O campo "MECÂNICO RESPONSÁVEL" é obrigatório para exportar o laudo.');
    }
    const method = exportMethod;
    setExportMethod(null);

    // Pequeno timeout para permitir que o Modal deflue da tela suavemente antes de abrir PDFs ou WhatsApp
    setTimeout(() => {
      if (method === 'whatsapp') gerarResumoWhatsApp();
      else if (method === 'pdf') exportPDF();
    }, 400);
  };

  const handleAdminReset = async () => {
    if (adminKey === 'D2412') {
      await SecureStore.deleteItemAsync('app_license_key');
      await SecureStore.deleteItemAsync('nome_oficina');
      setAuthenticated(false);
      setHeader({ placa: '', km: '', marca: '', modelo: '', ano: '', cor: '', dono: '', mecanico: '' });
      setChecklist(initialState);
      setPhotos([]);
      setWorkshopName('OFICINA CHECKLISTPRO');
      setAdminModalVisible(false);
      setAdminKey('');
    } else {
      Alert.alert('Acesso Negado', 'Senha incorreta.');
    }
  };

  const updateItemStatus = (category: string, item: string, newStatus: StatusType) => {
    setChecklist((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [item]: {
          ...prev[category][item],
          status: newStatus,
        },
      },
    }));
  };

  const updateItemObservation = (category: string, item: string, text: string) => {
    setChecklist((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [item]: {
          ...prev[category][item],
          observation: text,
        },
      },
    }));
  };

  const getProgress = () => {
    let total = 0;
    let completed = 0;
    Object.values(checklist).forEach(categoryItems => {
      Object.values(categoryItems).forEach(item => {
        total++;
        if (item.status !== 'pendente') completed++;
      });
    });
    return { total, completed, percentage: Math.round((completed / total) * 100) || 0 };
  };

  const progress = getProgress();

  const handleStartChecklist = (enforceValidation: boolean) => {
    if (enforceValidation) {
      if (!header.placa || !header.km) {
        Alert.alert('Atenção', 'Placa e KM são campos obrigatórios para cadastrar.');
        return;
      }
    }
    setCurrentScreen('checklist');
  };

  const pickImage = async (useCamera: boolean) => {
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 0.5,
      base64: true,
    };

    let result;
    if (useCamera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return Alert.alert('Permissão Negada', 'Habilite a câmera para tirar fotos.');
      result = await ImagePicker.launchCameraAsync(options);
    } else {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return Alert.alert('Permissão Negada', 'Habilite a galeria para anexar fotos.');
      result = await ImagePicker.launchImageLibraryAsync(options);
    }

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const newPhoto = {
        uri: result.assets[0].uri,
        base64: result.assets[0].base64 || ''
      };
      setPhotos([...photos, newPhoto]);
    }
  };

  const handleAddPhoto = () => {
    Alert.alert('Adicionar Foto', 'Escolha a fonte da imagem', [
      { text: 'Câmera', onPress: () => pickImage(true) },
      { text: 'Galeria', onPress: () => pickImage(false) },
      { text: 'Cancelar', style: 'cancel' }
    ]);
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const gerarResumoWhatsApp = async () => {
    let text = `*LAUDO TÉCNICO - ${workshopName}*\n`;
    text += `Veículo: ${header.marca || '-'} ${header.modelo || ''} | Placa: ${header.placa || 'Sem placa'}\n`;
    if (header.km) text += `KM: ${header.km}\n`;
    text += `CLIENTE: ${header.dono || '-'} | MECÂNICO: ${header.mecanico}\n`;
    text += `-----------------------\n`;

    const atencao: string[] = [];
    const criticos: string[] = [];

    Object.entries(checklist).forEach(([category, items]) => {
      Object.entries(items).forEach(([itemName, itemState]) => {
        if (itemState.status === 'atencao') atencao.push(`- ${itemName}`);
        else if (itemState.status === 'erro') criticos.push(`- ${itemName}`);
      });
    });

    if (atencao.length === 0 && criticos.length === 0) {
      text += `✅ Veículo impecável. Nenhum item com atenção ou erro encontrado.\n`;
    } else {
      if (atencao.length > 0) text += `\n🚨 *Atenção Necessária:* ${atencao.length} itens.`;
      if (criticos.length > 0) text += `\n❌ *Itens Críticos:* ${criticos.length} itens.`;
    }

    text += `\n\n📄 Foi gerado um Laudo em PDF detalhado. Por favor, solicite ou visualize o arquivo PDF compartilhado, ele possui fotografias e tabelas de diagnóstico completas.`;

    const encoded = encodeURIComponent(text);
    const url = `whatsapp://send?text=${encoded}`;

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Atenção', 'WhatsApp não está instalado neste dispositivo.');
      }
    } catch (error) {
      Alert.alert('Erro', 'Ocorreu um problema ao abrir o WhatsApp.');
    }
  };

  const exportPDF = async () => {
    try {
      const htmlContent = generateHTMLReport(header, checklist, photos, workshopName);
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível gerar e compartilhar o PDF.');
    }
  };

  // ----------------------------------------------------
  // Render: ATIVAÇÃO (LICENÇA)
  // ----------------------------------------------------
  if (authenticated === null) {
    return <View className="flex-1 bg-zinc-950" />;
  }

  if (!authenticated) {
    return <AuthScreen onAuthenticated={() => setAuthenticated(true)} />;
  }

  // ----------------------------------------------------
  // Render: HOME (IDENTIFICAÇÃO)
  // ----------------------------------------------------
  if (currentScreen === 'identificacao') {
    const validModelos = header.marca && header.marca !== 'Outros' ? MODELOS[header.marca] : ['Outros'];

    return (
      <View className="flex-1 bg-zinc-950" style={{ paddingBottom: Math.max(insets.bottom, 20) }}>
        <StatusBar style="light" />
        <View className="px-6 pb-4 border-b border-zinc-900 bg-zinc-950 items-center justify-center" style={{ paddingTop: insets.top, marginTop: 40 }}>
          <Text className="text-3xl font-extrabold text-zinc-100 tracking-tight">Checklist<Text className="text-blue-500">Pro</Text></Text>
        </View>

        <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ paddingBottom: 60 }}>
          <View className="w-full">
            {/* Linha 1: Placa */}
            <TextInput
              className="w-full bg-[#1A1A1A] text-zinc-200 px-4 h-[56px] mb-4 rounded-[12px] border border-zinc-800 text-center text-lg font-semibold"
              placeholder="PLACA"
              placeholderTextColor="#71717a"
              keyboardType="default"
              autoCapitalize="characters"
              value={header.placa}
              onChangeText={t => setHeader({ ...header, placa: t })}
            />

            {/* Linha 2: Marca */}
            <SelectInput
              options={MARCAS}
              label="Marca"
              value={header.marca}
              onSelect={(val) => setHeader({ ...header, marca: val, modelo: '' })}
              placeholder="MARCA"
            />

            {/* Linha 3: Modelo */}
            <SelectInput
              options={validModelos}
              label="Modelo"
              value={header.modelo}
              onSelect={(val) => setHeader({ ...header, modelo: val })}
              disabled={!header.marca}
              placeholder="MODELO"
            />

            {/* Linha 4: Ano */}
            <SelectInput
              options={ANOS}
              label="Ano"
              value={header.ano}
              onSelect={(val) => setHeader({ ...header, ano: val })}
              placeholder="ANO"
            />

            {/* Linha 5: Quilometragem */}
            <TextInput
              className="w-full bg-[#1A1A1A] text-zinc-200 px-4 h-[56px] mb-4 rounded-[12px] border border-zinc-800 text-center text-lg font-semibold"
              placeholder="KM"
              placeholderTextColor="#71717a"
              keyboardType="numeric"
              value={header.km}
              onChangeText={t => setHeader({ ...header, km: t })}
            />

            {/* Action Buttons */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleStartChecklist(true)}
              className="w-full bg-blue-600 h-[56px] mb-4 rounded-[12px] flex-row justify-center items-center"
            >
              <Text className="text-zinc-50 font-bold text-lg text-center tracking-wide"> INICIAR CHECKLIST </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.6}
              onPress={() => handleStartChecklist(false)}
              className="w-full bg-[#1A1A1A] h-[56px] mb-4 rounded-[12px] border border-zinc-800 flex-row justify-center items-center"
            >
              <Text className="text-zinc-400 font-semibold text-base text-center">Pular Formalidades</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              activeOpacity={0.5} 
              onPress={() => setAdminModalVisible(true)}
              className="mt-6 mb-4 items-center justify-center p-2"
              style={{ opacity: 0.3 }}
            >
              <Text className="text-zinc-400 text-xs font-bold tracking-widest">FORMATAR APP</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ----------------------------------------------------
  // Render: CHECKLIST
  // ----------------------------------------------------
  return (
    <View className="flex-1 bg-zinc-950" style={{ paddingBottom: Math.max(insets.bottom, 20) }}>
      <StatusBar style="light" />

      {/* Header Info */}
      <View className="px-6 pb-6 border-b border-zinc-900 bg-zinc-950" style={{ paddingTop: Math.max(insets.top, 50) }}>
        <View className="flex-row justify-between items-center mb-1">
          <View>
            <Text className="text-3xl font-extrabold text-zinc-100 tracking-tight">Checklist<Text className="text-blue-500">Pro</Text></Text>
            <Text className="text-zinc-400 mt-1 mb-4 text-base">Inspecionando: {header.placa || 'Veículo Não Identificado'}</Text>
          </View>
          <TouchableOpacity onPress={() => setCurrentScreen('identificacao')} className="bg-zinc-900 px-3 py-2 rounded-lg border border-zinc-800">
            <Text className="text-zinc-300 text-xs font-bold">MENU</Text>
          </TouchableOpacity>
        </View>

        {/* Progress Bar */}
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-zinc-300 font-medium text-sm">Progresso da Inspeção</Text>
          <Text className="text-blue-400 font-bold text-sm">{progress.percentage}%</Text>
        </View>
        <View className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden">
          <View
            className="h-full bg-blue-500"
            style={{ width: `${progress.percentage}%` }}
          />
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-6"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        {/* Categorias */}
        {Object.entries(checklist).map(([category, items]) => (
          <Accordion
            key={category}
            title={category}
            defaultOpen={true}
            themeClass={getCategoryTheme(category)}
          >
            {Object.entries(items).map(([itemName, itemState]) => (
              <ChecklistItem
                key={itemName}
                name={itemName}
                status={itemState.status}
                observation={itemState.observation}
                onStatusChange={(status) => updateItemStatus(category, itemName, status)}
                onObservationChange={(text) => updateItemObservation(category, itemName, text)}
              />
            ))}
          </Accordion>
        ))}

        {/* Galeria de Fotos Module */}
        <View className="mt-8 mb-6 bg-zinc-900/60 p-5 rounded-2xl border border-zinc-800">
          <Text className="text-zinc-100 font-bold mb-2 text-xl tracking-wide text-center">📸 GALERIA DE FOTOS</Text>
          <Text className="text-zinc-400 text-center text-sm mb-5">Anexe fotografias para enriquecer o PDF final.</Text>

          <View className="flex-row flex-wrap gap-3 justify-center mb-4">
            {photos.map((photo, index) => (
              <View key={index} className="relative rounded-xl overflow-hidden border border-zinc-700 h-28 w-28">
                <Image source={{ uri: photo.uri }} className="w-full h-full" resizeMode="cover" />
                <TouchableOpacity
                  onPress={() => removePhoto(index)}
                  className="absolute top-1 right-1 bg-red-600/90 p-1.5 rounded-full"
                >
                  <Trash2 size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleAddPhoto}
            className="bg-zinc-800/80 rounded-xl p-4 flex-row justify-center items-center border border-zinc-700 border-dashed"
          >
            <Camera size={20} color="#a1a1aa" className="mr-2" />
            <Text className="text-zinc-300 font-bold text-sm tracking-wide"> ADICIONAR FOTO </Text>
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View className="mt-4 mb-2 flex-row gap-3">
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setExportMethod('whatsapp')}
            className="flex-1 bg-green-600 rounded-xl p-4 justify-center items-center"
          >
            <Text className="text-zinc-50 font-bold text-sm text-center tracking-wide"> 💬 TEXTO (ZAP) </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setExportMethod('pdf')}
            className="flex-1 bg-zinc-200 rounded-xl p-4 justify-center items-center"
          >
            <Text className="text-zinc-950 font-bold text-sm text-center tracking-wide"> 📄 PDF FOTOS </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Modal Checkout Identificação */}
      <Modal transparent visible={!!exportMethod} animationType="fade" onRequestClose={() => setExportMethod(null)}>
        <View className="flex-1 justify-center bg-black/80 px-6">
          <View className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
            <Text className="text-white font-extrabold text-xl text-center mb-6 tracking-wide">FINALIZAR LAUDO</Text>

            <TextInput
              className="w-full bg-[#1A1A1A] text-zinc-200 px-4 h-[56px] mb-4 rounded-[12px] border border-zinc-800 text-center text-lg font-semibold"
              placeholder="NOME DO CLIENTE"
              placeholderTextColor="#71717a"
              autoCapitalize="words"
              value={header.dono}
              onChangeText={t => setHeader({ ...header, dono: t })}
            />

            <TextInput
              className="w-full bg-[#1A1A1A] text-zinc-200 px-4 h-[56px] mb-6 rounded-[12px] border border-zinc-800 text-center text-lg font-semibold"
              placeholder="MECÂNICO RESPONSÁVEL *"
              placeholderTextColor="#71717a"
              autoCapitalize="words"
              value={header.mecanico}
              onChangeText={t => setHeader({ ...header, mecanico: t })}
            />

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={confirmExport}
              className="w-full bg-blue-600 h-[56px] rounded-[12px] flex-row justify-center items-center mb-3"
            >
              <Text className="text-zinc-50 font-bold text-lg text-center tracking-wide"> GERAR E ENVIAR </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.6}
              onPress={() => setExportMethod(null)}
              className="w-full py-3"
            >
              <Text className="text-zinc-400 font-semibold text-center">Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Admin Reset */}
      <Modal transparent visible={adminModalVisible} animationType="fade" onRequestClose={() => setAdminModalVisible(false)}>
        <View className="flex-1 justify-center bg-black/80 px-6">
          <View className="bg-zinc-900 border border-red-900/50 rounded-2xl p-6 shadow-xl">
            <Text className="text-red-500 font-extrabold text-xl text-center mb-2 tracking-wide">AÇÃO DE ADMINISTRADOR</Text>
            <Text className="text-zinc-400 text-center mb-6">Digite a senha de acesso para formatar o sistema.</Text>
            
            <TextInput 
              className="w-full bg-[#1A1A1A] text-zinc-200 px-4 h-[56px] mb-6 rounded-[12px] border border-zinc-800 text-center text-lg font-semibold tracking-widest" 
              placeholder="SENHA ADMIN" 
              placeholderTextColor="#71717a" 
              secureTextEntry
              autoCapitalize="characters"
              value={adminKey} 
              onChangeText={setAdminKey} 
            />

            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={handleAdminReset}
              className="w-full bg-red-700 h-[56px] rounded-[12px] flex-row justify-center items-center mb-3"
            >
              <Text className="text-zinc-50 font-bold text-lg text-center tracking-wide"> FORMATAR </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              activeOpacity={0.6}
              onPress={() => { setAdminModalVisible(false); setAdminKey(''); }}
              className="w-full py-3"
            >
              <Text className="text-zinc-400 font-semibold text-center">Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}
