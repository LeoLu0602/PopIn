import { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../lib/supabase';
import { getPostHog } from '../lib/posthog';
import { PrimaryButton, SecondaryButton } from '../components/Button';

const OSU_DOMAIN = '@osu.edu';

export default function AuthScreen() {
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [otpSent, setOtpSent] = useState(false);
    const [cooldown, setCooldown] = useState(0);

    useEffect(() => {
        if (cooldown > 0) {
            const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [cooldown]);

    const normalizeOsuEmail = (value: string) => {
        const cleaned = value.toLowerCase().trim();

        if (!cleaned) return '';
        if (cleaned.endsWith(OSU_DOMAIN)) return cleaned;
        if (cleaned.includes('@')) return cleaned;

        return `${cleaned}${OSU_DOMAIN}`;
    };

    const validateEmail = (value: string) => value.endsWith(OSU_DOMAIN);

    const handleEmailChange = (value: string) => {
        const cleaned = value.toLowerCase().trim();

        if (cleaned.endsWith(OSU_DOMAIN)) {
            setEmail(cleaned.slice(0, -OSU_DOMAIN.length));
            return;
        }

        setEmail(cleaned);
    };

    const handleSendOTP = async () => {
        const normalizedEmail = normalizeOsuEmail(email);

        if (!normalizedEmail) {
            Alert.alert('Error', 'Please enter your email');
            return;
        }

        if (!validateEmail(normalizedEmail)) {
            Alert.alert('Error', 'Please use your @osu.edu email address');
            return;
        }

        setLoading(true);
        const { error } = await supabase.auth.signInWithOtp({
            email: normalizedEmail,
        });

        setLoading(false);

        if (error) {
            Alert.alert('Error', error.message);
        } else {
            setOtpSent(true);
            setCooldown(30);
            Alert.alert('Success', 'Check your email for the login code');
        }
    };

    const handleVerifyOTP = async () => {
        const normalizedEmail = normalizeOsuEmail(email);

        if (!otp.trim()) {
            Alert.alert('Error', 'Please enter the verification code');
            return;
        }

        if (!normalizedEmail || !validateEmail(normalizedEmail)) {
            Alert.alert('Error', 'Please enter a valid @osu.edu email');
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase.auth.verifyOtp({
                email: normalizedEmail,
                token: otp.trim(),
                type: 'email',
            });

            if (error) {
                Alert.alert('Error', error.message);
                return;
            }

            if (data.user) {
                getPostHog().identify(data.user.id, {
                    email: data.user.email ?? null,
                });

                // Create profile if it doesn't exist.
                const { error: profileError } = await (supabase
                    .from('profiles') as any)
                    .upsert(
                        {
                            id: data.user.id,
                            email: data.user.email!,
                        },
                        {
                            onConflict: 'id',
                            ignoreDuplicates: true,
                        },
                    );

                if (profileError) {
                    console.error('Profile creation error:', profileError);
                }
            }
        } catch (error) {
            console.error('OTP verification failed:', error);
            Alert.alert('Error', 'Failed to verify code. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1"
        >
            <ScrollView
                className="flex-1 bg-osu-light"
                contentContainerStyle={{
                    flexGrow: 1,
                    justifyContent: 'center',
                    paddingHorizontal: 24,
                    paddingVertical: 24,
                }}
            >
                <StatusBar style="dark" />
                <View className="w-full max-w-md self-center">
                    <View className="items-center mb-8">
                        <Text className="text-5xl font-bold text-osu-scarlet mb-2">
                            PopIn
                        </Text>
                        <Text className="text-lg text-osu-dark">
                            OSU Student Events
                        </Text>
                    </View>

                    <View className="w-full bg-white rounded-2xl p-6 shadow-lg">
                        <Text className="text-2xl font-bold text-osu-dark mb-6">
                            {otpSent ? 'Verify Code' : 'Sign In'}
                        </Text>

                        {!otpSent ? (
                            <>
                                <Text className="text-osu-dark mb-2 font-medium">
                                    OSU Email
                                </Text>
                                <TextInput
                                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 mb-6 text-base"
                                    placeholder="name.#"
                                    placeholderTextColor="#6B7280"
                                    value={email}
                                    onChangeText={handleEmailChange}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                    autoComplete="email"
                                    textContentType="emailAddress"
                                    editable={!loading}
                                />

                                <Text className="text-gray-500 text-sm -mt-4 mb-6">
                                    @{'osu.edu'}
                                </Text>

                                <PrimaryButton
                                    title={
                                        cooldown > 0
                                            ? `Wait ${cooldown}s`
                                            : 'Send Code'
                                    }
                                    onPress={handleSendOTP}
                                    loading={loading}
                                    disabled={cooldown > 0}
                                />

                                <Text className="text-gray-500 text-sm mt-4 text-center">
                                    Only @osu.edu emails are allowed
                                </Text>
                            </>
                        ) : (
                            <>
                                <Text className="text-gray-600 mb-4">
                                    Enter the 6-digit code sent to {normalizeOsuEmail(email)}
                                </Text>

                                <Text className="text-osu-dark mb-2 font-medium">
                                    Verification Code
                                </Text>
                                <TextInput
                                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 mb-6 text-base text-center tracking-widest"
                                    placeholder="000000"
                                    placeholderTextColor="#6B7280"
                                    value={otp}
                                    onChangeText={setOtp}
                                    keyboardType="number-pad"
                                    maxLength={6}
                                    editable={!loading}
                                />

                                <PrimaryButton
                                    title="Verify"
                                    onPress={handleVerifyOTP}
                                    loading={loading}
                                />

                                <View className="mt-4">
                                    <SecondaryButton
                                        title={
                                            cooldown > 0
                                                ? `Wait ${cooldown}s`
                                                : 'Send New Code'
                                        }
                                        onPress={() => {
                                            setOtpSent(false);
                                            setOtp('');
                                        }}
                                        disabled={loading || cooldown > 0}
                                    />
                                </View>
                            </>
                        )}
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
