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

    function scrollToTop() {
        if (typeof window === 'undefined') return
        window.scrollTo({ top: 0, behavior: 'smooth' })
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
            scrollToTop()
            return
        }

        if (!isValidEmail(email)) {
            error.value = 'Invalid email address'
            scrollToTop()
            return
        }

        if (!isValidNamibianID(idNumber)) {
            error.value = 'Invalid Namibian ID number'
            scrollToTop()
            return
        }

        if (!isValidNamibianPhone(phone)) {
            error.value = 'Invalid Namibian phone number'
            scrollToTop()
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
            scrollToTop()
            return
        }

        if (d > 6) {
            error.value = 'Loan duration may not exceed 6 months'
            scrollToTop()
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
            scrollToTop()
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
            scrollToTop()
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
            scrollToTop()
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
            addToast({ message: sendEmail ? 'Loan saved and contract emailed' : 'Loan saved', variant: 'success' })
            goBackAfterSave()

        } catch (e: any) {
            error.value = e?.data?.message ?? 'Loan creation failed'
            addToast({ message: error.value, variant: 'error' })
            scrollToTop()
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
    <div class="page-shell-no-nav relative w-full mx-auto flex flex-col items-center overflow-x-hidden">

    <!-- Header -->
    <button
        @click="back"
        class="absolute left-6 top-6 text-cyan-500 hover:text-cyan-600"
        aria-label="Go back"
    >
        <ArrowLeft class="w-5 h-5" />
    </button>
    <header class="flex flex-col items-center justify-center mb-6 w-full gap-3">
        <h1 class="text-3xl font-semibold heading">Create Loan</h1>
        <div class="card-muted px-4 py-2 text-xs text-gray-600">
            Email delivery is disabled in this demo. Contracts will not be emailed.
        </div>
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
        <div class="card p-6 space-y-6 w-full">
            <div class="flex flex-col">
                <h3 class="text-lg font-medium">Client Information</h3>
                <p v-if="error" class="text-red-400 text-sm">{{ error }}</p>
            </div>

            <div class="field">
                <label class="text-sm">Full Name</label>
                <input v-model="client.fullName" class="input" :class="error ? 'border-red-300' : ''" placeholder="Full Name" />
            </div>
            <div class="field">
                <label class="text-sm">Email</label>
                <input v-model="client.email" class="input" :class="error ? 'border-red-300' : ''" placeholder="Email" />
            </div>
            <div class="field">
                <label class="text-sm">Phone</label>
                <input type="tel" v-model="client.phone" class="input" :class="error ? 'border-red-300' : ''" placeholder="Phone" />
            </div>
            <div class="field">
                <label class="text-sm">ID Number</label>
                <input v-model="client.idNumber" class="input" :class="error ? 'border-red-300' : ''" placeholder="ID Number" />
            </div>
            <div class="field">
                <label class="text-sm">Employment Number</label>
                <input type="text" v-model="client.empNumber" class="input" :class="error ? 'border-red-300' : ''" placeholder="Employment number">
            </div>
        </div>
        </section>

        <!-- STEP 2: LOAN -->
        <section class="w-full shrink-0">
        <div class="card p-6 space-y-4 w-full">
            <div class="flex flex-col">
                <h3 class="text-lg font-medium">Loan Information</h3>
                <p v-if="error" class="text-red-400 text-sm">{{ error }}</p>
            </div>

            <div class="field">
                <label class="text-sm">Amount</label>
                <input type="number" v-model="loan.amount" class="input" :class="error ? 'border-red-300' : ''" placeholder="Amount" />
            </div>
            <div class="field">
                <label class="text-sm">Duration</label>
                <input type="number" v-model="loan.duration" class="input" :class="error ? 'border-red-300' : ''" placeholder="Duration" />
            </div>
            <div class="field">
                <label class="text-sm">Interest %</label>
                <input type="number" v-model="loan.interest" class="input" :class="error ? 'border-red-300' : ''" placeholder="Interest %" />
            </div>
            <div class="field">
                <label class="text-sm">Monthly Salary</label>
                <input type="number" v-model="loan.salary" class="input" :class="error ? 'border-red-300' : ''" placeholder="Monthly salary" />
            </div>
            <div class="field">
                <label class="text-sm">Salary Deduction</label>
                <input type="number" v-model="loan.deduction" class="input" :class="error ? 'border-red-300' : ''" placeholder="Salary Deduction" />
            </div>
        </div>
        </section>

        <section class="w-full shrink-0">
        <div class="card p-6 space-y-4 w-full">
            <div class="flex flex-col">
                <h3 class="text-lg font-medium">cont'</h3>
                <p v-if="error" class="text-red-400 text-sm">{{ error }}</p>
            </div>

            <div class="field">
                <label class="text-sm">Bank</label>
                <input type="text" v-model="fin.bank" class="input" :class="error ? 'border-red-300' : ''" placeholder="Bank"/>
            </div>
            <div class="field">
                <label class="text-sm">Branch Code</label>
                <input type="number" v-model="fin.branchCode" class="input" :class="error ? 'border-red-300' : ''" placeholder="Branch code" />
            </div>
            <div class="field">
                <label class="text-sm">Account Number</label>
                <input type="number" v-model="fin.accountNo" class="input" :class="error ? 'border-red-300' : ''" placeholder="Account number" />
            </div>
        </div>
        </section>

        <!-- STEP 3: DOCUMENTS -->
        <section class="w-full shrink-0">
        <div class="card p-6 space-y-4 w-full">

            <div>
                <h3 class="text-lg font-medium">Upload Documents</h3>
                <p v-if="error" class="text-red-400 text-sm">{{ error }}</p>
            </div>
            
            <div class="relative border border-dashed h-12 flex flex-col rounded justify-center px-2">
                <label class="flex flex-row gap-2 items-center w-full min-w-0">
                    <Upload size="20"/>
                    <span
                        class="truncate"
                        :title="documents.idCopy?.name || ''"
                    >
                        {{ documents.idCopy?.name ?? 'Upload Id copy' }}
                    </span>
                </label>
                <input
                    type="file"
                    class="block absolute w-full h-full opacity-0 cursor-pointer"
                    accept="image/*,application/pdf"
                    @change="e => documents.idCopy = (e.target as HTMLInputElement).files?.[0] ?? null"
                />
            </div>
            <div class="relative border border-dashed h-12 flex flex-col rounded justify-center px-2">
                <label class="flex flex-row gap-2 items-center w-full min-w-0">
                    <Upload size="20"/>
                    <span
                        class="truncate"
                        :title="documents.payslips?.name || ''"
                    >
                        {{ documents.payslips?.name ?? 'Upload Payslip' }}
                    </span>
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
                <label class="flex flex-row gap-2 items-center w-full min-w-0">
                    <Upload size="20"/>
                    <span
                        class="truncate"
                        :title="documents.bankStatement?.name || ''"
                    >
                        {{ documents.bankStatement?.name ?? 'Upload Bank Statement' }}
                    </span>
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
            <div class="card p-6 space-y-4 h-[80vh] flex flex-col w-full">

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
                class="btn btn-outline"
            >
                Previous
            </button>

            <button
                @click="forward"
                :disabled="processing"
                class="btn btn-primary"
            >
                <Loader2 v-if="processing" class="w-4 h-4 animate-spin" />
                {{ nextButtonLabel() }}
            </button>
            <button
                v-if="currentStep === 4"
                @click="saveAndEmailContract"
                :disabled="processing"
                class="btn btn-primary"
            >
                <Loader2 v-if="processing" class="w-4 h-4 animate-spin" />
                Save and email contract
            </button>
        </div>

        <button @click="cancel" class="btn text-sm text-red-500 hover:text-red-600">
            Cancel
        </button>
    </div>
    </div>
    </div>
</template>

<style scoped>
    .input {
        @apply w-full rounded-lg border border-[color:var(--border)] bg-white px-4 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-200;
    }
    .field {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
</style>
