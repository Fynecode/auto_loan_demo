<script setup lang="ts">

    import { ref } from 'vue'
    import { useRouter, useRoute } from 'vue-router'
    import { Upload } from 'lucide-vue-next'
    import { isValidNamibianID, isValidEmail, isValidNamibianPhone, hasEmptyFields } from '../utils/loanValidation'

    const router = useRouter()
    const route = useRoute()

    const currentStep = ref(0)
    const totalSteps = 5

    const error = ref<string | null>(null)

    const processing = ref(false)
    const canProceed = ref(false)
    const contractPreviewUrl = ref<string | null>(null)
    const contractPreviewFile = ref<File | null>(null)

    // Extracted data (mocked for now)
    const client = ref({
        fullName: '',
        email: '',
        idNumber: '',
        empNumber: '',
        phone: ''
    })

    const prefill = route.query
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
        salary: null as number | null,
        deduction: null as number | null,
    })

    const fin = ref({
        bank: null as number | null,
        branchCode: null as number | null,
        accountNo: null as number | null,
    })

    const documents = ref<{
        bankStatement: File | null
        payslips: File | null
        idCopy: File | null
        contractTemplate: File | null
    }>({
        bankStatement: null,
        payslips: null,
        idCopy: null,
        contractTemplate: null
    })

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

    try {
        const form = new FormData()

        // Files
        form.append('bankStatement', documents.value.bankStatement!)
        form.append('payslip', documents.value.payslips!)
        form.append('idCopy', documents.value.idCopy!)
        form.append('template', documents.value.contractTemplate!)

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

        contractPreviewFile.value = new File([blob], 'contract.pdf', {
            type: 'application/pdf'
        })

        contractPreviewUrl.value = URL.createObjectURL(blob)

        next()

        } catch (e: any) {
            error.value = e?.data?.message ?? 'Loan creation failed'
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
        await createPreview()
        next()
    }

    async function submitLoan(){
        error.value = null
        processing.value = true

        try {
            if (!contractPreviewFile.value) {
                error.value = 'Contract preview is missing'
                return
            }

            const form = new FormData()

            // Files
            form.append('bankStatement', documents.value.bankStatement!)
            form.append('payslip', documents.value.payslips!)
            form.append('idCopy', documents.value.idCopy!)
            form.append('contract', contractPreviewFile.value)

            // Structured payload
            form.append(
                'data',
                JSON.stringify({
                    client: client.value,
                    loan: buildLoanPayload()
                })
            )

            await $fetch('/api/loans/', {
                method: 'POST',
                body: form,
                responseType: 'arrayBuffer'
            })

        } catch (e: any) {
            error.value = e?.data?.message ?? 'Loan creation failed'
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
</script>

<template>
    <div class="relative w-full h-screen mx-auto flex flex-col items-center py-6 overflow-x-hidden">

    <!-- Header -->
    <header class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-semibold">Create Loan</h1>
    </header>

    <!-- Indicators -->
    <div class="flex w-[40%] gap-2 mb-4">
        <div
            v-for="i in totalSteps"
            :key="i"
            class="h-1 flex-1 rounded"
            :class="i - 1 <= currentStep ? 'bg-cyan-400' : 'bg-gray-200'"
        />
    </div>

    <!-- Slider -->
    <div
        class="flex transition-transform duration-500 ease-in-out"
        :style="{ transform: `translateX(-${currentStep * 100}%)` }"
    >

        <!-- STEP 1: CLIENT -->
        <section class="min-w-full">
        <div class="rounded-2xl p-6 space-y-4">
            <div class="flex flex-col">
                <h3 class="text-lg font-medium">Client Information</h3>
                <p v-if="error" class="text-red-400 text-sm">{{ error }}</p>
            </div>

            <input v-model="client.fullName" class="input" placeholder="Full Name" />
            <input v-model="client.email" class="input" placeholder="Email" />
            <input type="tel" v-model="client.phone" class="input" placeholder="Phone" />
            <input v-model="client.idNumber" class="input" placeholder="ID Number" />
            <input type="text" v-model="client.empNumber" class="input" placeholder="Employment number">
        </div>
        </section>

        <!-- STEP 2: LOAN -->
        <section class="min-w-full">
        <div class="rounded-2xl p-6 space-y-4">
            <div class="flex flex-col">
                <h3 class="text-lg font-medium">Loan Information</h3>
                <p v-if="error" class="text-red-400 text-sm">{{ error }}</p>
            </div>

            <input type="number" v-model="loan.amount" class="input" placeholder="Amount" />
            <input type="number" v-model="loan.duration" class="input" placeholder="Duration" />
            <input type="number" v-model="loan.interest" class="input" placeholder="Interest %" />
            <input type="number" v-model="loan.salary" class="input" placeholder="Monthly salary" />
            <input type="number" v-model="loan.deduction" class="input" placeholder="Salary Deduction" />
        </div>
        </section>

        <section class="min-w-full">
        <div class="rounded-2xl p-6 space-y-4">
            <div class="flex flex-col">
                <h3 class="text-lg font-medium">cont'</h3>
                <p v-if="error" class="text-red-400 text-sm">{{ error }}</p>
            </div>

            <input type="text" v-model="fin.bank" class="input" placeholder="Bank"/>
            <input type="number" v-model="fin.branchCode" class="input" placeholder="Branch code" />
            <input type="number" v-model="fin.accountNo" class="input" placeholder="Account number" />
        </div>
        </section>

        <!-- STEP 3: DOCUMENTS -->
        <section class="min-w-full">
        <div class=" rounded-2xl p-6 space-y-4">

            <div>
                <h3 class="text-lg font-medium">Upload Documents</h3>
                <p v-if="error" class="text-red-400 text-sm">{{ error }}</p>
            </div>
            
            <div class="relative border border-dashed h-12 flex flex-col rounded justify-center px-2">
                <label for="" class="flex flex-row gap-2 items-center"><Upload size="20"/> Upload Id copy</label>
                <input
                    type="file"
                    class="block absolute w-full h-full opacity-0 cursor-pointer"
                    accept="image/*,application/pdf"
                    @change="e => documents.idCopy = (e.target as HTMLInputElement).files?.[0] ?? null"
                />
            </div>
            <div class="relative border border-dashed h-12 flex flex-col rounded justify-center px-2">
                <label for="" class="flex flex-row gap-2 items-center"><Upload size="20"/> Upload Payslip</label>
                <input 
                    type="file" 
                    multiple 
                    class="block absolute w-full h-full opacity-0 cursor-pointer"
                    accept="application/pdf"
                    @change="e => documents.payslips = (e.target as HTMLInputElement).files?.[0] ?? null"
                />
            </div>
            <div class="relative border border-dashed h-12 flex flex-col rounded justify-center px-2">
                <label for="" class="flex flex-row gap-2 items-center"><Upload size="20"/> Upload Bank Statement</label>
                <input
                    type="file" 
                    class="block absolute w-full h-full opacity-0 cursor-pointer" 
                    accept="application/pdf"
                    @change="e => documents.bankStatement = (e.target as HTMLInputElement).files?.[0] ?? null"
                />
            </div>
            <div class="relative border border-dashed h-12 flex rounded items-center px-2">
                <label class="flex gap-2 items-center">
                    <Upload size="20" /> Upload Contract Template (DOCX)
                </label>
                <input
                    type="file"
                    accept=".docx"
                    class="absolute w-full h-full opacity-0 cursor-pointer"
                    @change="e => documents.contractTemplate = (e.target as HTMLInputElement).files?.[0] ?? null"
                />
            </div>

        </div>
        </section>
        <section class="min-w-full" v-if="currentStep === 4">
            <div class="rounded-2xl p-6 space-y-4 h-[80vh] flex flex-col">

                <h3 class="text-lg font-medium">Contract Preview</h3>

                <div v-if="contractPreviewUrl" class="flex-1 border rounded overflow-hidden">
                <iframe
                    :src="contractPreviewUrl"
                    class="w-full h-full"
                />
                </div>

            </div>
        </section>

    </div>

    <!-- Navigation -->
    <div class="flex flex-row px-6 items-center mt-6 justify-between text-white w-full">
        <div class="flex flex-row gap-4">
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
                class="bg-blue-600 py-1 px-4 rounded cursor-pointer"
            >
                {{currentStep >= 4? 'Create loan': 'Next'}}
            </button>
        </div>

        <button @click="cancel" class="text-sm text-red-400 py-1 px-4">
            Cancel
        </button>
    </div>
    </div>
</template>

<style scoped>
    .input {
        @apply border rounded-lg px-4 py-2 w-full;
    }
</style>
