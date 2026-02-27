<script setup lang="ts">

    import { computed, ref } from 'vue'
    import { useRouter, useRoute } from 'vue-router'
    import { ArrowLeft, Upload, Loader2 } from 'lucide-vue-next'
    import { isValidNamibianID, isValidEmail, isValidNamibianPhone, hasEmptyFields } from '../utils/loanValidation'
    import { useToast } from '~/composables/useToast'

    const router = useRouter()
    const route = useRoute()
    const { addToast } = useToast()

    const currentStep = ref(0)
    const totalSteps = 5

    const error = ref<string | null>(null)

    const processing = ref(false)
    const canProceed = ref(false)
    const contractPreviewUrl = ref<string | null>(null)

    // Extracted data (mocked for now)
    const client = ref({
        fullName: '',
        email: '',
        idNumber: '',
        empNumber: '',
        phone: ''
    })

    const prefill = route.query
    const returnTo = computed(() => (typeof route.query.from === 'string' ? route.query.from : ''))
    if (prefill) {
        client.value.fullName = String(prefill.fullName ?? '') || client.value.fullName
        client.value.email = String(prefill.email ?? '') || client.value.email
        client.value.idNumber = String(prefill.idNumber ?? '') || client.value.idNumber
        client.value.empNumber = String(prefill.empNumber ?? '') || client.value.empNumber
        client.value.phone = String(prefill.phone ?? '') || client.value.phone
    }

    const loan = ref({
        amount: null as number | null,
        duration: null as number | null,
        interest: null as number | null,
        quantity: null as number | null,
        salary: null as number | null,
        deduction: null as number | null,
    })

    if (prefill) {
        const amount = Number(prefill.amount)
        const duration = Number(prefill.duration)
        const interest = Number(prefill.interest)
        const quantity = Number(prefill.quantity)
        loan.value.amount = Number.isFinite(amount) ? amount : loan.value.amount
        loan.value.duration = Number.isFinite(duration) ? duration : loan.value.duration
        loan.value.interest = Number.isFinite(interest) ? interest : loan.value.interest
        loan.value.quantity = Number.isFinite(quantity) ? quantity : loan.value.quantity
    }

    const fin = ref({
        bank: null as number | null,
        branchCode: null as number | null,
        accountNo: null as number | null,
    })

    const documents = ref<{
        bankStatement: File | null
        payslips: File | null
        idCopy: File | null
    }>({
        bankStatement: null,
        payslips: null,
        idCopy: null
    })

    function back() {
        router.back()
    }

    function nextButtonLabel() {
        if (currentStep.value === 3) return 'Preview contract'
        if (currentStep.value === 4) return 'Save loan'
        return 'Next'
    }

    function next() {
        if (currentStep.value < totalSteps - 1) {
            currentStep.value++
        }
    }

    function prev() {
        if (currentStep.value > 0) {
            currentStep.value--
        }
    }

    function cancel() {
        router.back()
    }

    function goBackAfterSave() {
        if (returnTo.value) {
            router.push(returnTo.value)
            return
        }
        if (typeof window !== 'undefined' && window.history.length > 1) {
            router.back()
            return
        }
        router.push('/dashboard')
    }

    function buildLoanPayload() {
        return {
            ...loan.value,
            bank: fin.value.bank,
            accountNumber: fin.value.accountNo,
            branchCode: fin.value.branchCode
        }
    }

    async function verifyClientInfo() {
        error.value = null

        const { fullName, email, idNumber, empNumber, phone } = client.value

        if (hasEmptyFields({ fullName, email, idNumber, empNumber, phone })) {
            error.value = 'Please fill all fields'
            return
        }

        if (!isValidEmail(email)) {
            error.value = 'Invalid email address'
            return
        }

        if (!isValidNamibianID(idNumber)) {
            error.value = 'Invalid Namibian ID number'
            return
        }

        if (!isValidNamibianPhone(phone)) {
            error.value = 'Invalid Namibian phone number'
            return
        }

        canProceed.value = true
        error.value = null
        next()
    }

    async function verifyLoanInfo() {
        error.value = null

        const { amount, duration, interest, salary, deduction } = loan.value
        const d = Number(duration)

        if (hasEmptyFields({ amount, duration, interest, salary, deduction })) {
            error.value = 'Please fill all fields'
            return
        }

        if (d > 6) {
            error.value = 'Loan duration may not exceed 6 months'
            return
        }

        canProceed.value = true
        next()
    }

    async function verifyFinInfo() {
        error.value = null

        const { bank, accountNo} = fin.value

        if (hasEmptyFields({ bank, accountNo })) {
            error.value = 'Please fill all fields'
            return
        }

        canProceed.value = true
        next()
    }

    async function createPreview() {
        error.value = null
        processing.value = true
        contractPreviewUrl.value = null

        try {
            const form = new FormData()

            // Structured payload
            form.append(
                'data',
                JSON.stringify({
                    client: client.value,
                    loan: buildLoanPayload()
                })
            )

            const { data: contract, error: contractError } = await useFetch('/api/loans/contract', {
                method: 'POST',
                body: form,
                responseType: 'arrayBuffer'
            })

            if (contractError.value) {
                throw contractError.value
            }

            const blob = new Blob([contract.value], {
                type: 'application/pdf'
            })

            contractPreviewUrl.value = URL.createObjectURL(blob)
            return true
        } catch (e: any) {
            error.value = e?.data?.message ?? 'Loan creation failed'
            return false
        } finally {
            processing.value = false
        }
    }

    async function verifyDocuments() {
        error.value = null

        if (
            !documents.value.bankStatement ||
            !documents.value.payslips ||
            !documents.value.idCopy
        ) {
            error.value = 'Please upload all required documents'
            return
        }

        processing.value = true
        const ok = await createPreview()
        if (!ok) return
        next()
    }

    async function submitLoan(sendEmail = false){
        error.value = null
        processing.value = true

        try {
            const form = new FormData()

            // Files
            form.append('bankStatement', documents.value.bankStatement!)
            form.append('payslip', documents.value.payslips!)
            form.append('idCopy', documents.value.idCopy!)

            // Structured payload
            form.append(
                'data',
                JSON.stringify({
                    client: client.value,
                    loan: buildLoanPayload()
                })
            )
            form.append('sendEmail', sendEmail ? 'true' : 'false')

            await $fetch('/api/loans/', {
                method: 'POST',
                body: form,
                responseType: 'arrayBuffer'
            })
            addToast(sendEmail ? 'Loan saved and contract emailed' : 'Loan saved', 'success')
            goBackAfterSave()

        } catch (e: any) {
            error.value = e?.data?.message ?? 'Loan creation failed'
            addToast(error.value, 'error')
        } finally {
            processing.value = false
        }
    }

    async function forward() {
        
        switch (currentStep.value) {
            case 0:
                await verifyClientInfo()
                break
            case 1:
                await verifyLoanInfo()
                break
            case 2:
                await verifyFinInfo()
                break
            case 3:
                await verifyDocuments()
                break
            case 4:
                await submitLoan()
                break
            default:
                break
        }
    }

    async function saveAndEmailContract() {
        await submitLoan(true)
    }
</script>

<template>
    <div class="relative w-full min-h-screen mx-auto flex flex-col items-center py-6 overflow-x-hidden">

    <!-- Header -->
    <button
        @click="back"
        class="absolute left-6 top-6 text-cyan-500 hover:text-cyan-600"
        aria-label="Go back"
    >
        <ArrowLeft class="w-5 h-5" />
    </button>
    <header class="flex items-center justify-center mb-6 w-full">
        <h1 class="text-2xl font-semibold">Create Loan</h1>
    </header>

    <div class="w-full max-w-2xl overflow-hidden">
    <!-- Indicators -->
    <div class="flex w-full gap-2 mb-4">
        <div
            v-for="i in totalSteps"
            :key="i"
            class="h-1 flex-1 rounded"
            :class="i - 1 <= currentStep ? 'bg-cyan-400' : 'bg-gray-200'"
        />
    </div>

    <!-- Slider -->
    <div
        class="flex w-full transition-transform duration-500 ease-in-out"
        :style="{ transform: `translateX(-${currentStep * 100}%)` }"
    >

        <!-- STEP 1: CLIENT -->
        <section class="w-full shrink-0">
        <div class="rounded-2xl p-6 space-y-6 w-full">
            <div class="flex flex-col">
                <h3 class="text-lg font-medium">Client Information</h3>
                <p v-if="error" class="text-red-400 text-sm">{{ error }}</p>
            </div>

            <div class="field">
                <label class="text-sm">Full Name</label>
                <input v-model="client.fullName" class="input" placeholder="Full Name" />
            </div>
            <div class="field">
                <label class="text-sm">Email</label>
                <input v-model="client.email" class="input" placeholder="Email" />
            </div>
            <div class="field">
                <label class="text-sm">Phone</label>
                <input type="tel" v-model="client.phone" class="input" placeholder="Phone" />
            </div>
            <div class="field">
                <label class="text-sm">ID Number</label>
                <input v-model="client.idNumber" class="input" placeholder="ID Number" />
            </div>
            <div class="field">
                <label class="text-sm">Employment Number</label>
                <input type="text" v-model="client.empNumber" class="input" placeholder="Employment number">
            </div>
        </div>
        </section>

        <!-- STEP 2: LOAN -->
        <section class="w-full shrink-0">
        <div class="rounded-2xl p-6 space-y-4 w-full">
            <div class="flex flex-col">
                <h3 class="text-lg font-medium">Loan Information</h3>
                <p v-if="error" class="text-red-400 text-sm">{{ error }}</p>
            </div>

            <div class="field">
                <label class="text-sm">Amount</label>
                <input type="number" v-model="loan.amount" class="input" placeholder="Amount" />
            </div>
            <div class="field">
                <label class="text-sm">Duration</label>
                <input type="number" v-model="loan.duration" class="input" placeholder="Duration" />
            </div>
            <div class="field">
                <label class="text-sm">Interest %</label>
                <input type="number" v-model="loan.interest" class="input" placeholder="Interest %" />
            </div>
            <div class="field">
                <label class="text-sm">Monthly Salary</label>
                <input type="number" v-model="loan.salary" class="input" placeholder="Monthly salary" />
            </div>
            <div class="field">
                <label class="text-sm">Salary Deduction</label>
                <input type="number" v-model="loan.deduction" class="input" placeholder="Salary Deduction" />
            </div>
        </div>
        </section>

        <section class="w-full shrink-0">
        <div class="rounded-2xl p-6 space-y-4 w-full">
            <div class="flex flex-col">
                <h3 class="text-lg font-medium">cont'</h3>
                <p v-if="error" class="text-red-400 text-sm">{{ error }}</p>
            </div>

            <div class="field">
                <label class="text-sm">Bank</label>
                <input type="text" v-model="fin.bank" class="input" placeholder="Bank"/>
            </div>
            <div class="field">
                <label class="text-sm">Branch Code</label>
                <input type="number" v-model="fin.branchCode" class="input" placeholder="Branch code" />
            </div>
            <div class="field">
                <label class="text-sm">Account Number</label>
                <input type="number" v-model="fin.accountNo" class="input" placeholder="Account number" />
            </div>
        </div>
        </section>

        <!-- STEP 3: DOCUMENTS -->
        <section class="w-full shrink-0">
        <div class=" rounded-2xl p-6 space-y-4 w-full">

            <div>
                <h3 class="text-lg font-medium">Upload Documents</h3>
                <p v-if="error" class="text-red-400 text-sm">{{ error }}</p>
            </div>
            
            <div class="relative border border-dashed h-12 flex flex-col rounded justify-center px-2">
                <label class="flex flex-row gap-2 items-center">
                    <Upload size="20"/>
                    {{ documents.idCopy?.name ?? 'Upload Id copy' }}
                </label>
                <input
                    type="file"
                    class="block absolute w-full h-full opacity-0 cursor-pointer"
                    accept="image/*,application/pdf"
                    @change="e => documents.idCopy = (e.target as HTMLInputElement).files?.[0] ?? null"
                />
            </div>
            <div class="relative border border-dashed h-12 flex flex-col rounded justify-center px-2">
                <label class="flex flex-row gap-2 items-center">
                    <Upload size="20"/>
                    {{ documents.payslips?.name ?? 'Upload Payslip' }}
                </label>
                <input 
                    type="file" 
                    multiple 
                    class="block absolute w-full h-full opacity-0 cursor-pointer"
                    accept="application/pdf"
                    @change="e => documents.payslips = (e.target as HTMLInputElement).files?.[0] ?? null"
                />
            </div>
            <div class="relative border border-dashed h-12 flex flex-col rounded justify-center px-2">
                <label class="flex flex-row gap-2 items-center">
                    <Upload size="20"/>
                    {{ documents.bankStatement?.name ?? 'Upload Bank Statement' }}
                </label>
                <input
                    type="file" 
                    class="block absolute w-full h-full opacity-0 cursor-pointer" 
                    accept="application/pdf"
                    @change="e => documents.bankStatement = (e.target as HTMLInputElement).files?.[0] ?? null"
                />
            </div>
        </div>
        </section>
        <section class="w-full shrink-0" v-if="currentStep === 4">
            <div class="rounded-2xl p-6 space-y-4 h-[80vh] flex flex-col w-full">

                <h3 class="text-lg font-medium">Contract Preview</h3>

                <div v-if="contractPreviewUrl" class="flex-1 border rounded overflow-hidden">
                    <iframe
                        :src="contractPreviewUrl"
                        class="w-full h-full max-h-full"
                    />
                </div>

            </div>
        </section>

    </div>

    <!-- Navigation -->
    <div class="flex flex-col md:flex-row px-4 md:px-6 items-start md:items-center mt-6 justify-between text-white w-full gap-4">
        <div class="flex flex-col md:flex-row gap-3 md:gap-4 w-full md:w-auto">
            <button
                @click="prev"
                :disabled="currentStep === 0"
                class="py-1 px-4 rounded transition-all"
                :class="currentStep === 0 ? 'bg-blue-200' : 'bg-blue-400 cursor-pointer'"
            >
                Previous
            </button>

            <button
                @click="forward"
                :disabled="processing"
                class="bg-blue-600 py-1 px-4 rounded cursor-pointer inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
                <Loader2 v-if="processing" class="w-4 h-4 animate-spin" />
                {{ nextButtonLabel() }}
            </button>
            <button
                v-if="currentStep === 4"
                @click="saveAndEmailContract"
                :disabled="processing"
                class="bg-blue-500 py-1 px-4 rounded cursor-pointer inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
                <Loader2 v-if="processing" class="w-4 h-4 animate-spin" />
                Save and email contract
            </button>
        </div>

        <button @click="cancel" class="text-sm text-red-400 py-1 px-4">
            Cancel
        </button>
    </div>
    </div>
    </div>
</template>

<style scoped>
    .input {
        @apply border rounded-lg px-4 py-2 w-full;
    }
    .field {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
</style>
