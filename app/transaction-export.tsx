/**
 * Pantalla para exportar transacciones por mes
 * 
 * Funcionalidades:
 * - Seleccionar mes y año
 * - Generar tabla con categorías (horizontal) y días (vertical)
 * - Mostrar totales por fila (día) y columna (categoría)
 * - Compartir/Imprimir/Exportar
 */

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UniversalDatePicker } from '@/components/UniversalDatePicker';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { subscribeToAccountTransactions } from '@/services/transactions';
import type { Account, Transaction } from '@/types';
import { MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Print from 'expo-print';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€',
  USD: '$',
  COP: '$',
};

export default function TransactionExportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ accountId?: string }>();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const colors = Colors[theme];

  const accountId = params.accountId;

  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showMonthPicker, setShowMonthPicker] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);

  const datePickerLocale = language === 'es' ? 'es-ES' : 'en-US';

  /**
   * Carga los datos de la cuenta
   */
  useEffect(() => {
    const loadAccount = async () => {
      if (!accountId) {
        router.back();
        return;
      }

      try {
        const accountRef = doc(db, 'accounts', accountId);
        const accountDoc = await getDoc(accountRef);
        if (accountDoc.exists()) {
          const accountData = accountDoc.data();
          const loadedAccount: Account = {
            id: accountDoc.id,
            name: accountData.name,
            type: accountData.type,
            currency: accountData.currency,
            ownerId: accountData.ownerId,
            memberIds: accountData.memberIds,
            inviteCode: accountData.inviteCode || undefined,
            createdAt: accountData.createdAt,
            updatedAt: accountData.updatedAt,
          } as Account;
          setAccount(loadedAccount);
        } else {
          router.back();
        }
      } catch (error) {
        console.error('Error cargando cuenta:', error);
        router.back();
      } finally {
        setLoading(false);
      }
    };

    loadAccount();
  }, [accountId, router]);

  /**
   * Listener en tiempo real para transacciones
   */
  useEffect(() => {
    if (!accountId) return;

    const unsubscribe = subscribeToAccountTransactions(accountId, (newTransactions) => {
      setTransactions(newTransactions);
    }, 1000);

    return () => unsubscribe();
  }, [accountId]);

  /**
   * Filtra transacciones por mes seleccionado
   */
  const filteredTransactions = useMemo(() => {
    if (!selectedDate) return [];

    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();

    return transactions.filter((transaction) => {
      if (!transaction.date) return false;
      const transactionDate = transaction.date.toDate();
      return (
        transactionDate.getFullYear() === year &&
        transactionDate.getMonth() === month
      );
    });
  }, [transactions, selectedDate]);

  /**
   * Obtiene todas las categorías únicas de las transacciones filtradas
   */
  const categories = useMemo(() => {
    const cats = new Set<string>();
    filteredTransactions.forEach((t) => cats.add(t.category));
    return Array.from(cats).sort();
  }, [filteredTransactions]);

  /**
   * Obtiene todos los días del mes con transacciones
   */
  const daysInMonth = useMemo(() => {
    if (!selectedDate) return [];
    
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days: number[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dayDate = new Date(year, month, day);
      const hasTransactions = filteredTransactions.some((t) => {
        if (!t.date) return false;
        const transactionDate = t.date.toDate();
        return (
          transactionDate.getDate() === day &&
          transactionDate.getMonth() === month &&
          transactionDate.getFullYear() === year
        );
      });
      if (hasTransactions) {
        days.push(day);
      }
    }
    return days.sort((a, b) => a - b);
  }, [filteredTransactions, selectedDate]);

  /**
   * Obtiene el monto de una transacción para un día y categoría específicos
   */
  const getTransactionAmount = (day: number, category: string): number => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    
    return filteredTransactions
      .filter((t) => {
        if (!t.date) return false;
        const transactionDate = t.date.toDate();
        return (
          transactionDate.getDate() === day &&
          transactionDate.getMonth() === month &&
          transactionDate.getFullYear() === year &&
          t.category === category
        );
      })
      .reduce((sum, t) => {
        return sum + (t.type === 'INCOME' ? t.amount : -t.amount);
      }, 0);
  };

  /**
   * Calcula el total de un día (fila)
   */
  const getDayTotal = (day: number): number => {
    return categories.reduce((sum, category) => {
      return sum + getTransactionAmount(day, category);
    }, 0);
  };

  /**
   * Calcula el total de una categoría (columna)
   */
  const getCategoryTotal = (category: string): number => {
    return daysInMonth.reduce((sum, day) => {
      return sum + getTransactionAmount(day, category);
    }, 0);
  };

  /**
   * Calcula el total general
   */
  const getGrandTotal = (): number => {
    return daysInMonth.reduce((sum, day) => {
      return sum + getDayTotal(day);
    }, 0);
  };

  /**
   * Formatea un número como moneda
   */
  const formatCurrency = (amount: number): string => {
    if (!account) return amount.toString();
    
    const currency = account.currency;
    if (currency === 'COP') {
      return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(Math.round(amount));
    } else {
      const locale = currency === 'EUR' ? 'de-DE' : 'en-US';
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    }
  };

  /**
   * Calcula el ancho necesario para cada columna basándose en el contenido
   */
  const calculateColumnWidths = useMemo(() => {
    if (daysInMonth.length === 0 || categories.length === 0) {
      return {};
    }

    const widths: Record<number, number> = {};
    
    // Columna 0: Día - debe acomodar "Día", números de día, y "Total"
    const dayHeader = 'Día';
    const dayMax = daysInMonth.length > 0 ? Math.max(...daysInMonth.map(d => d.toString().length)) : 0;
    const totalText = 'Total';
    // Calcular el ancho necesario para el texto más largo
    // Medir el ancho real del texto más largo considerando el tamaño de fuente
    const maxTextLength = Math.max(dayHeader.length, dayMax, totalText.length);
    // Usar un multiplicador más generoso (18px por carácter) + padding extra para asegurar que "Total" no se corte
    const dayWidth = Math.max(90, maxTextLength * 18 + 50);
    widths[0] = dayWidth;
    
    // Columnas de categorías (1 a categories.length)
    categories.forEach((cat, index) => {
      const colIndex = index + 1;
      let maxLength = cat.length;
      
      // Verificar todos los valores en esta columna
      daysInMonth.forEach((day) => {
        const amount = getTransactionAmount(day, cat);
        if (amount !== 0) {
          const formatted = formatCurrency(amount);
          maxLength = Math.max(maxLength, formatted.length);
        }
      });
      
      // Verificar el total de la categoría
      const categoryTotal = formatCurrency(getCategoryTotal(cat));
      maxLength = Math.max(maxLength, categoryTotal.length);
      
      // Calcular ancho: mínimo 100px, pero ajustado al contenido con más margen
      // Usar 10px por carácter para monedas formateadas (incluye símbolos)
      widths[colIndex] = Math.max(110, maxLength * 10 + 40);
    });
    
    // Última columna: Total
    const totalColIndex = categories.length + 1;
    let totalMaxLength = 'Total'.length;
    
    daysInMonth.forEach((day) => {
      const dayTotal = formatCurrency(getDayTotal(day));
      totalMaxLength = Math.max(totalMaxLength, dayTotal.length);
    });
    
    const grandTotal = formatCurrency(getGrandTotal());
    totalMaxLength = Math.max(totalMaxLength, grandTotal.length);
    
    widths[totalColIndex] = Math.max(130, totalMaxLength * 10 + 40);
    
    return widths;
  }, [categories, daysInMonth, account]);

  /**
   * Genera el contenido CSV para exportar
   */
  const generateCSV = (): string => {
    if (!account) return '';

    let csv = `${account.name} - ${selectedDate.toLocaleDateString(datePickerLocale, { month: 'long', year: 'numeric' })}\n\n`;
    
    // Encabezado: Día, Categorías..., Total
    csv += 'Día,';
    categories.forEach((cat) => {
      csv += `${cat},`;
    });
    csv += 'Total\n';

    // Filas: Día, Montos por categoría..., Total del día
    daysInMonth.forEach((day) => {
      csv += `${day},`;
      categories.forEach((cat) => {
        const amount = getTransactionAmount(day, cat);
        csv += `${amount !== 0 ? amount.toFixed(2) : ''},`;
      });
      csv += `${getDayTotal(day).toFixed(2)}\n`;
    });

    // Fila de totales por categoría
    csv += 'Total,';
    categories.forEach((cat) => {
      csv += `${getCategoryTotal(cat).toFixed(2)},`;
    });
    csv += `${getGrandTotal().toFixed(2)}\n`;

    return csv;
  };

  /**
   * Genera HTML imprimible bien organizado
   */
  const generatePrintableHTML = (): string => {
    if (!account) return '';

    const monthName = selectedDate.toLocaleDateString(datePickerLocale, { month: 'long', year: 'numeric' });
    
    let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${account.name} - ${monthName}</title>
  <style>
    @media print {
      body { margin: 0; padding: 20px; }
      .no-print { display: none; }
    }
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 20px;
      background: white;
      color: black;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 3px solid #333;
      padding-bottom: 15px;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: bold;
    }
    .header h2 {
      margin: 5px 0 0 0;
      font-size: 20px;
      color: #666;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 12px;
    }
    th, td {
      border: 1px solid #333;
      padding: 10px 8px;
      text-align: center;
      vertical-align: middle;
    }
    th {
      background-color: #f0f0f0;
      font-weight: bold;
      font-size: 11px;
    }
    .day-cell {
      width: 50px;
      font-weight: 600;
    }
    .category-cell {
      min-width: 100px;
      max-width: 120px;
    }
    .amount-cell {
      font-weight: 500;
    }
    .total-col {
      background-color: #e8e8e8;
      font-weight: bold;
    }
    .total-row {
      background-color: #e8e8e8;
      font-weight: bold;
    }
    .total-row .total-col {
      background-color: #d0d0d0;
      font-weight: 700;
    }
    .positive {
      color: #34C759;
    }
    .negative {
      color: #FF3B30;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${account.name}</h1>
    <h2>${monthName}</h2>
  </div>
  <table>
    <thead>
      <tr>
        <th class="day-cell">Día</th>`;

    categories.forEach((cat) => {
      html += `<th class="category-cell">${cat}</th>`;
    });

    html += `<th class="total-col">Total</th>
      </tr>
    </thead>
    <tbody>`;

    daysInMonth.forEach((day) => {
      html += `<tr>
        <td class="day-cell">${day}</td>`;
      categories.forEach((cat) => {
        const amount = getTransactionAmount(day, cat);
        const amountClass = amount > 0 ? 'positive' : amount < 0 ? 'negative' : '';
        html += `<td class="amount-cell ${amountClass}">${amount !== 0 ? formatCurrency(amount) : ''}</td>`;
      });
      const dayTotal = getDayTotal(day);
      const totalClass = dayTotal >= 0 ? 'positive' : 'negative';
      html += `<td class="total-col ${totalClass}">${formatCurrency(dayTotal)}</td>
      </tr>`;
    });

    html += `<tr class="total-row">
      <td class="day-cell">Total</td>`;
    categories.forEach((cat) => {
      const total = getCategoryTotal(cat);
      const totalClass = total >= 0 ? 'positive' : 'negative';
      html += `<td class="total-col ${totalClass}">${formatCurrency(total)}</td>`;
    });
    const grandTotal = getGrandTotal();
    const grandTotalClass = grandTotal >= 0 ? 'positive' : 'negative';
    html += `<td class="total-col ${grandTotalClass}">${formatCurrency(grandTotal)}</td>
    </tr>
    </tbody>
  </table>
</body>
</html>`;

    return html;
  };

  /**
   * Helper para importar jsPDF solo en web
   * Esto evita que Metro bundler intente resolver el módulo en móvil
   */
  const importJsPDF = async () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      throw new Error('jsPDF solo disponible en web');
    }
    // Usar una cadena dinámica para evitar que Metro lo analice en tiempo de build
    const moduleName = 'jspdf';
    return await import(/* webpackIgnore: true */ moduleName);
  };

  /**
   * Genera PDF usando jsPDF (web) o HTML (móvil)
   */
  const generatePDF = async (): Promise<void> => {
    if (!account) return;

    try {
      setExporting(true);

      if (Platform.OS === 'web') {
        // Usar jsPDF para generar PDF directamente (solo en web)
        try {
          // Importación dinámica solo en web para evitar warnings en móvil
          const jsPDFModule = await importJsPDF();
          const { jsPDF } = jsPDFModule;
          
          const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4',
          });

          const monthName = selectedDate.toLocaleDateString(datePickerLocale, { month: 'long', year: 'numeric' });
          
          // Encabezado
          pdf.setFontSize(20);
          pdf.text(account.name, 14, 20);
          pdf.setFontSize(14);
          pdf.text(monthName, 14, 28);

          // Configurar tabla
          const startY = 35;
          const cellHeight = 8;
          const margin = 14;
          let currentY = startY;
          
          // Calcular anchos de columnas en mm basándose en el contenido
          const colWidths: number[] = [];
          colWidths.push(15); // Columna Día
          categories.forEach(() => {
            colWidths.push(25); // Columnas de categorías
          });
          colWidths.push(25); // Columna Total
          
          const totalWidth = colWidths.reduce((sum, w) => sum + w, 0);
          const pageWidth = 297; // A4 landscape width in mm
          const scale = (pageWidth - margin * 2) / totalWidth;
          
          // Ajustar anchos
          colWidths.forEach((w, i) => {
            colWidths[i] = w * scale;
          });

          // Encabezado de tabla
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'bold');
          let currentX = margin;
          
          // Día
          pdf.rect(currentX, currentY, colWidths[0], cellHeight);
          pdf.text('Día', currentX + colWidths[0] / 2, currentY + cellHeight / 2, { align: 'center', baseline: 'middle' });
          currentX += colWidths[0];
          
          // Categorías
          categories.forEach((cat, index) => {
            pdf.rect(currentX, currentY, colWidths[index + 1], cellHeight);
            pdf.text(cat, currentX + colWidths[index + 1] / 2, currentY + cellHeight / 2, { align: 'center', baseline: 'middle' });
            currentX += colWidths[index + 1];
          });
          
          // Total
          pdf.rect(currentX, currentY, colWidths[colWidths.length - 1], cellHeight);
          pdf.text('Total', currentX + colWidths[colWidths.length - 1] / 2, currentY + cellHeight / 2, { align: 'center', baseline: 'middle' });
          
          currentY += cellHeight;
          pdf.setFont('helvetica', 'normal');

          // Filas de datos
          daysInMonth.forEach((day) => {
            if (currentY + cellHeight > 200) { // Nueva página si es necesario
              pdf.addPage();
              currentY = startY;
            }
            
            currentX = margin;
            
            // Día
            pdf.rect(currentX, currentY, colWidths[0], cellHeight);
            pdf.text(day.toString(), currentX + colWidths[0] / 2, currentY + cellHeight / 2, { align: 'center', baseline: 'middle' });
            currentX += colWidths[0];
            
            // Categorías
            categories.forEach((cat, index) => {
              const amount = getTransactionAmount(day, cat);
              pdf.rect(currentX, currentY, colWidths[index + 1], cellHeight);
              if (amount !== 0) {
                pdf.setTextColor(amount > 0 ? 52 : 255, amount > 0 ? 199 : 59, amount > 0 ? 89 : 48);
                pdf.text(formatCurrency(amount), currentX + colWidths[index + 1] / 2, currentY + cellHeight / 2, { align: 'center', baseline: 'middle' });
                pdf.setTextColor(0, 0, 0);
              }
              currentX += colWidths[index + 1];
            });
            
            // Total del día
            const dayTotal = getDayTotal(day);
            pdf.rect(currentX, currentY, colWidths[colWidths.length - 1], cellHeight);
            pdf.setTextColor(dayTotal >= 0 ? 52 : 255, dayTotal >= 0 ? 199 : 59, dayTotal >= 0 ? 89 : 48);
            pdf.setFont('helvetica', 'bold');
            pdf.text(formatCurrency(dayTotal), currentX + colWidths[colWidths.length - 1] / 2, currentY + cellHeight / 2, { align: 'center', baseline: 'middle' });
            pdf.setTextColor(0, 0, 0);
            pdf.setFont('helvetica', 'normal');
            
            currentY += cellHeight;
          });

          // Fila de totales
          if (currentY + cellHeight > 200) {
            pdf.addPage();
            currentY = startY;
          }
          
          currentX = margin;
          pdf.setFont('helvetica', 'bold');
          
          // Total
          pdf.rect(currentX, currentY, colWidths[0], cellHeight);
          pdf.text('Total', currentX + colWidths[0] / 2, currentY + cellHeight / 2, { align: 'center', baseline: 'middle' });
          currentX += colWidths[0];
          
          // Totales por categoría
          categories.forEach((cat, index) => {
            const total = getCategoryTotal(cat);
            pdf.rect(currentX, currentY, colWidths[index + 1], cellHeight);
            pdf.setTextColor(total >= 0 ? 52 : 255, total >= 0 ? 199 : 59, total >= 0 ? 89 : 48);
            pdf.text(formatCurrency(total), currentX + colWidths[index + 1] / 2, currentY + cellHeight / 2, { align: 'center', baseline: 'middle' });
            currentX += colWidths[index + 1];
          });
          
          // Total general
          const grandTotal = getGrandTotal();
          pdf.rect(currentX, currentY, colWidths[colWidths.length - 1], cellHeight);
          pdf.setTextColor(grandTotal >= 0 ? 52 : 255, grandTotal >= 0 ? 199 : 59, grandTotal >= 0 ? 89 : 48);
          pdf.text(formatCurrency(grandTotal), currentX + colWidths[colWidths.length - 1] / 2, currentY + cellHeight / 2, { align: 'center', baseline: 'middle' });
          
          // Descargar PDF
          const fileName = `${account.name}_${selectedDate.getFullYear()}_${selectedDate.getMonth() + 1}.pdf`;
          pdf.save(fileName);
          
          Alert.alert(t('common.success'), 'PDF generado y descargado');
        } catch (error) {
          // Si hay error, usar impresión del navegador como fallback
          console.error('Error generando PDF con jsPDF:', error);
          const html = generatePrintableHTML();
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
            setTimeout(() => {
              printWindow.print();
            }, 250);
          }
        }
      } else {
        // En móvil, usar expo-print para generar PDF directamente
        try {
          const html = generatePrintableHTML();
          
          // Generar PDF usando expo-print
          const { uri } = await Print.printToFileAsync({
            html: html,
          });
          
          // Abrir el diálogo de compartir/guardar PDF
          // No mostrar error si el usuario cancela (el error es esperado cuando se cancela)
          try {
            await Print.printAsync({
              uri: uri,
            });
            // Solo mostrar éxito si no se canceló
            Alert.alert(
              t('common.success'),
              'PDF generado exitosamente.',
              [{ text: 'OK' }]
            );
          } catch (printError: any) {
            // Si el error es de cancelación, no mostrar mensaje de error
            // "Printing did not complete" es el error cuando el usuario cancela
            if (printError?.message?.includes('Printing did not complete') || 
                printError?.message?.includes('cancelled') ||
                printError?.code === 'E_PRINT_CANCELLED') {
              // Usuario canceló, no hacer nada
              return;
            }
            // Otro tipo de error, mostrar mensaje
            throw printError;
          }
        } catch (error: any) {
          // Solo mostrar error si no es una cancelación
          if (error?.message?.includes('Printing did not complete') || 
              error?.message?.includes('cancelled') ||
              error?.code === 'E_PRINT_CANCELLED') {
            // Usuario canceló, no hacer nada
            return;
          }
          console.error('Error generando PDF con expo-print:', error);
          // Fallback: copiar HTML al portapapeles solo si es un error real
          const html = generatePrintableHTML();
          await Clipboard.setStringAsync(html);
          Alert.alert(
            t('common.error'),
            'No se pudo generar el PDF. El HTML se ha copiado al portapapeles como alternativa.',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('Error generando PDF:', error);
      Alert.alert(t('common.error'), 'Error al generar el PDF');
    } finally {
      setExporting(false);
    }
  };

  /**
   * Comparte el archivo imprimible
   */
  const handleShare = async () => {
    await generatePDF();
  };

  /**
   * Imprime la tabla (solo web)
   */
  const handlePrint = () => {
    if (Platform.OS !== 'web') {
      Alert.alert(t('common.info'), 'La impresión solo está disponible en la versión web');
      return;
    }

    if (!account) return;

    const html = generatePrintableHTML();
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  if (loading || !account) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.tint} />
            <ThemedText style={styles.loadingText}>Cargando...</ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.background }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backButton, { backgroundColor: colors.background + '20' }]}
            activeOpacity={0.7}>
            <MaterialIcons name="arrow-back" size={20} color={colors.tint} />
            <ThemedText style={[styles.backButtonText, { color: colors.tint }]}>
              {t('account.back')}
            </ThemedText>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          
          {/* Selector de Mes */}
          <View style={styles.inputContainer}>
            <ThemedText style={styles.label}>
              {t('export.month')} / {t('export.year')}
            </ThemedText>
            <TouchableOpacity
              style={[styles.dateButton, { borderColor: colors.icon }]}
              onPress={() => setShowMonthPicker(!showMonthPicker)}
              activeOpacity={0.7}>
              <ThemedText style={[styles.dateButtonText, { color: colors.text }]}>
                {selectedDate.toLocaleDateString(datePickerLocale, {
                  month: 'long',
                  year: 'numeric',
                })}
              </ThemedText>
            </TouchableOpacity>
            {showMonthPicker && (
              <View style={styles.datePickerContainer}>
                <UniversalDatePicker
                  value={selectedDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  locale={datePickerLocale}
                  textColor={theme === 'dark' ? '#FFFFFF' : '#000000'}
                  themeVariant={theme === 'dark' ? 'dark' : 'light'}
                  onChange={(selectedDate) => {
                    if (Platform.OS === 'android') {
                      setShowMonthPicker(false);
                    }
                    setSelectedDate(selectedDate);
                  }}
                />
                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={[styles.datePickerButton, { backgroundColor: colors.tint }]}
                    onPress={() => setShowMonthPicker(false)}>
                    <ThemedText style={[styles.datePickerButtonText, { color: '#FFFFFF' }]}>
                      {t('common.confirm')}
                    </ThemedText>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* Tabla de Transacciones */}
          {daysInMonth.length === 0 ? (
            <View style={styles.emptyContainer}>
              <ThemedText style={styles.emptyText}>
                No hay transacciones para este mes
              </ThemedText>
            </View>
          ) : (
            <View style={styles.tableContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                <View>
                  {/* Encabezado */}
                  <View style={[styles.tableRow, styles.tableHeader, { backgroundColor: colors.tint + '20' }]}>
                    <View style={[
                      styles.tableCell, 
                      styles.tableCellHeader, 
                      styles.dayCell,
                      { width: calculateColumnWidths[0] || 90 }
                    ]}>
                      <ThemedText style={[styles.tableCellText, styles.tableCellHeaderText]} numberOfLines={1}>
                        Día
                      </ThemedText>
                    </View>
                    {categories.map((cat, index) => (
                      <View 
                        key={cat} 
                        style={[
                          styles.tableCell, 
                          styles.tableCellHeader,
                          { width: calculateColumnWidths[index + 1] || 100 }
                        ]}>
                        <ThemedText style={[styles.tableCellText, styles.tableCellHeaderText]} numberOfLines={1}>
                          {cat}
                        </ThemedText>
                      </View>
                    ))}
                    <View style={[
                      styles.tableCell, 
                      styles.tableCellHeader, 
                      styles.totalColumn,
                      { width: calculateColumnWidths[categories.length + 1] || 120 }
                    ]}>
                      <ThemedText style={[styles.tableCellText, styles.tableCellHeaderText]} numberOfLines={1}>
                        Total
                      </ThemedText>
                    </View>
                  </View>

                  {/* Filas de datos */}
                  {daysInMonth.map((day) => (
                    <View key={day} style={[styles.tableRow, { borderBottomColor: colors.border }]}>
                      <View style={[
                        styles.tableCell, 
                        styles.dayCell,
                        { width: calculateColumnWidths[0] || 90 }
                      ]}>
                        <ThemedText style={[styles.tableCellText, styles.dayCellText, { fontWeight: '600' }]} numberOfLines={1}>
                          {day}
                        </ThemedText>
                      </View>
                      {categories.map((cat, index) => {
                        const amount = getTransactionAmount(day, cat);
                        return (
                          <View 
                            key={cat} 
                            style={[
                              styles.tableCell,
                              { width: calculateColumnWidths[index + 1] || 100 }
                            ]}>
                            <ThemedText
                              numberOfLines={1}
                              style={[
                                styles.tableCellText,
                                amount !== 0 && { color: amount > 0 ? colors.success : colors.error },
                              ]}>
                              {amount !== 0 ? formatCurrency(amount) : ''}
                            </ThemedText>
                          </View>
                        );
                      })}
                      <View style={[
                        styles.tableCell, 
                        styles.totalColumn,
                        { width: calculateColumnWidths[categories.length + 1] || 120 }
                      ]}>
                        <ThemedText
                          numberOfLines={1}
                          style={[
                            styles.tableCellText,
                            { fontWeight: '600', color: getDayTotal(day) >= 0 ? colors.success : colors.error },
                          ]}>
                          {formatCurrency(getDayTotal(day))}
                        </ThemedText>
                      </View>
                    </View>
                  ))}

                  {/* Fila de totales por categoría */}
                  <View style={[styles.tableRow, styles.totalRow, { backgroundColor: colors.tint + '10' }]}>
                    <View style={[
                      styles.tableCell, 
                      styles.dayCell, 
                      styles.totalRowCell,
                      { width: calculateColumnWidths[0] || 90 }
                    ]}>
                      <ThemedText style={[styles.tableCellText, styles.dayCellText, { fontWeight: '700' }]} numberOfLines={1}>
                        Total
                      </ThemedText>
                    </View>
                    {categories.map((cat, index) => {
                      const total = getCategoryTotal(cat);
                      return (
                        <View 
                          key={cat} 
                          style={[
                            styles.tableCell, 
                            styles.totalRowCell,
                            { width: calculateColumnWidths[index + 1] || 100 }
                          ]}>
                          <ThemedText
                            numberOfLines={1}
                            style={[
                              styles.tableCellText,
                              { fontWeight: '600', color: total >= 0 ? colors.success : colors.error },
                            ]}>
                            {formatCurrency(total)}
                          </ThemedText>
                        </View>
                      );
                    })}
                    <View style={[
                      styles.tableCell, 
                      styles.totalColumn, 
                      styles.totalRowCell,
                      { width: calculateColumnWidths[categories.length + 1] || 120 }
                    ]}>
                      <ThemedText
                        numberOfLines={1}
                        style={[
                          styles.tableCellText,
                          { fontWeight: '700', color: getGrandTotal() >= 0 ? colors.success : colors.error },
                        ]}>
                        {formatCurrency(getGrandTotal())}
                      </ThemedText>
                    </View>
                  </View>
                </View>
              </ScrollView>
            </View>
          )}

          {/* Botones de Acción */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.tint }]}
              onPress={handleShare}
              disabled={exporting || daysInMonth.length === 0}
              activeOpacity={0.7}>
              {exporting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="share" size={20} color="#FFFFFF" />
                  <ThemedText style={[styles.actionButtonText, { color: '#FFFFFF' }]}>
                    {t('export.share')}
                  </ThemedText>
                </>
              )}
            </TouchableOpacity>
            {Platform.OS === 'web' && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.tint + '80', borderColor: colors.tint, borderWidth: 1 }]}
                onPress={handlePrint}
                disabled={daysInMonth.length === 0}
                activeOpacity={0.7}>
                <MaterialIcons name="print" size={20} color={colors.tint} />
                <ThemedText style={[styles.actionButtonText, { color: colors.tint }]}>
                  {t('export.print')}
                </ThemedText>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    textAlign: 'center',
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  inputContainer: {
    marginBottom: 24,
    gap: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  dateButton: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  dateButtonText: {
    fontSize: 16,
  },
  datePickerContainer: {
    marginTop: 12,
    width: '100%',
  },
  datePickerButton: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  datePickerButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  tableContainer: {
    marginBottom: 24,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tableHeader: {
    borderBottomWidth: 2,
  },
  totalRow: {
    borderTopWidth: 2,
  },
  tableCell: {
    minWidth: 100,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
  },
  tableCellHeader: {
    backgroundColor: 'transparent',
  },
  dayCell: {
    minWidth: 90,
  },
  dayCellText: {
    fontSize: 12,
    textAlign: 'center',
  },
  totalColumn: {
    minWidth: 120,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  totalRowCell: {
    backgroundColor: 'transparent',
  },
  tableCellText: {
    fontSize: 11,
    textAlign: 'center',
  },
  tableCellHeaderText: {
    fontWeight: '700',
    fontSize: 13,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.7,
  },
  actionsContainer: {
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    opacity: 0.7,
  },
});
